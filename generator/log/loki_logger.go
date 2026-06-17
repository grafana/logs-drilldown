package log

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
)

const (
	defaultBatchWait  = 1 * time.Second
	defaultBatchSize  = 1024 * 1024
	defaultTimeout    = 10 * time.Second
	defaultMaxRetries = 10
	defaultMinBackoff = 500 * time.Millisecond
	defaultMaxBackoff = 5 * time.Minute
	protoContentType     = "application/x-protobuf"
	snappyContentEncoding = "snappy"
)

// LokiLoggerConfig configures a LokiLogger.
type LokiLoggerConfig struct {
	URL        string
	TenantID   string
	Token      string // BasicAuth password; username = TenantID
	MaxRetries int
	MinBackoff time.Duration
	MaxBackoff time.Duration
	BatchWait  time.Duration
	BatchSize  int
	Timeout    time.Duration
}

// LokiLogger pushes logs to Loki via snappy-compressed protobuf over HTTP.
type LokiLogger struct {
	cfg     LokiLoggerConfig
	client  *http.Client
	quit    chan struct{}
	once    sync.Once
	entries chan lokiEntry
	wg      sync.WaitGroup
}

type lokiEntry struct {
	labels model.LabelSet
	entry  push.Entry
}

// NewLokiLogger creates a LokiLogger and starts its background batch sender.
func NewLokiLogger(cfg LokiLoggerConfig) (*LokiLogger, error) {
	if cfg.URL == "" {
		return nil, errors.New("loki logger: URL is required")
	}
	if cfg.BatchWait <= 0 {
		cfg.BatchWait = defaultBatchWait
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = defaultBatchSize
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = defaultTimeout
	}
	if cfg.MaxRetries <= 0 {
		cfg.MaxRetries = defaultMaxRetries
	}
	if cfg.MinBackoff <= 0 {
		cfg.MinBackoff = defaultMinBackoff
	}
	if cfg.MaxBackoff <= 0 {
		cfg.MaxBackoff = defaultMaxBackoff
	}

	l := &LokiLogger{
		cfg:     cfg,
		client:  &http.Client{Timeout: cfg.Timeout},
		quit:    make(chan struct{}),
		entries: make(chan lokiEntry),
	}

	l.wg.Add(1)
	go l.run()
	return l, nil
}

func (l *LokiLogger) run() {
	batches := map[string]*lokiBatch{}

	minWaitCheckFrequency := 10 * time.Millisecond
	maxWaitCheckFrequency := l.cfg.BatchWait / 10
	if maxWaitCheckFrequency < minWaitCheckFrequency {
		maxWaitCheckFrequency = minWaitCheckFrequency
	}
	maxWaitCheck := time.NewTicker(maxWaitCheckFrequency)
	defer maxWaitCheck.Stop()

	defer func() {
		for _, batch := range batches {
			l.sendBatch(batch)
		}
		l.wg.Done()
	}()

	for {
		select {
		case <-l.quit:
			return

		case e := <-l.entries:
			labels := e.labels.String()
			batch, ok := batches[labels]
			if !ok {
				batches[labels] = newLokiBatch(e)
				break
			}
			if batch.sizeBytesAfter(e) > l.cfg.BatchSize {
				l.sendBatch(batch)
				batches[labels] = newLokiBatch(e)
				break
			}
			batch.add(e)

		case <-maxWaitCheck.C:
			for labels, batch := range batches {
				if batch.age() < l.cfg.BatchWait {
					continue
				}
				l.sendBatch(batch)
				delete(batches, labels)
			}
		}
	}
}

type lokiBatch struct {
	streams   map[string]*push.Stream
	bytes     int
	createdAt time.Time
}

func newLokiBatch(entries ...lokiEntry) *lokiBatch {
	b := &lokiBatch{
		streams:   map[string]*push.Stream{},
		bytes:     0,
		createdAt: time.Now(),
	}
	for _, e := range entries {
		b.add(e)
	}
	return b
}

func (b *lokiBatch) add(e lokiEntry) {
	b.bytes += len(e.entry.Line)
	labels := e.labels.String()
	if stream, ok := b.streams[labels]; ok {
		stream.Entries = append(stream.Entries, e.entry)
		return
	}
	b.streams[labels] = &push.Stream{
		Labels:  labels,
		Entries: []push.Entry{e.entry},
	}
}

func (b *lokiBatch) sizeBytesAfter(e lokiEntry) int {
	return b.bytes + len(e.entry.Line)
}

func (b *lokiBatch) age() time.Duration {
	return time.Since(b.createdAt)
}

func (b *lokiBatch) encode() ([]byte, int, error) {
	req := push.PushRequest{
		Streams: make([]push.Stream, 0, len(b.streams)),
	}
	entriesCount := 0
	for _, stream := range b.streams {
		req.Streams = append(req.Streams, *stream)
		entriesCount += len(stream.Entries)
	}
	buf, err := proto.Marshal(&req)
	if err != nil {
		return nil, 0, err
	}
	return snappy.Encode(nil, buf), entriesCount, nil
}

func (l *LokiLogger) sendBatch(batch *lokiBatch) {
	buf, _, err := batch.encode()
	if err != nil {
		return
	}

	ctx := context.Background()
	backoff := l.cfg.MinBackoff
	for attempt := 0; attempt <= l.cfg.MaxRetries; attempt++ {
		status, err := l.send(ctx, buf)
		if err == nil {
			return
		}
		if status > 0 && status != 429 && status/100 != 5 {
			return
		}
		if attempt == l.cfg.MaxRetries {
			return
		}
		time.Sleep(backoff)
		if backoff < l.cfg.MaxBackoff {
			backoff *= 2
			if backoff > l.cfg.MaxBackoff {
				backoff = l.cfg.MaxBackoff
			}
		}
	}
}

func (l *LokiLogger) send(ctx context.Context, buf []byte) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, l.cfg.Timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, l.cfg.URL, bytes.NewReader(buf))
	if err != nil {
		return -1, err
	}
	req.Header.Set("Content-Type", protoContentType)
	req.Header.Set("Content-Encoding", snappyContentEncoding)
	req.Header.Set("User-Agent", "logs-drilldown-generator/1.0")

	if l.cfg.TenantID != "" {
		req.Header.Set("X-Scope-OrgID", l.cfg.TenantID)
	}
	if l.cfg.Token != "" {
		req.SetBasicAuth(l.cfg.TenantID, l.cfg.Token)
	}

	resp, err := l.client.Do(req)
	if err != nil {
		return -1, err
	}
	defer resp.Body.Close()

	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return resp.StatusCode, fmt.Errorf("loki push: HTTP %s (%d): %s", resp.Status, resp.StatusCode, body)
	}
	return resp.StatusCode, nil
}

// Stop flushes pending batches and shuts down the background sender.
func (l *LokiLogger) Stop() {
	l.once.Do(func() { close(l.quit) })
	l.wg.Wait()
}

// Handle implements Logger.
func (l *LokiLogger) Handle(labels model.LabelSet, t time.Time, msg string) error {
	return l.HandleWithMetadata(labels, t, msg, nil)
}

// HandleWithMetadata implements Logger.
func (l *LokiLogger) HandleWithMetadata(labels model.LabelSet, t time.Time, msg string, md push.LabelsAdapter) error {
	l.entries <- lokiEntry{
		labels: labels,
		entry: push.Entry{
			Timestamp:          t,
			Line:               msg,
			StructuredMetadata: md,
		},
	}
	return nil
}
