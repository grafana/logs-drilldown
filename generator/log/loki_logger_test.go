package log

import (
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func decodePushRequest(t *testing.T, body []byte) push.PushRequest {
	t.Helper()
	decoded, err := snappy.Decode(nil, body)
	require.NoError(t, err)
	var req push.PushRequest
	require.NoError(t, proto.Unmarshal(decoded, &req))
	return req
}

func TestLokiLoggerImplementsLoggerInterface(t *testing.T) {
	var logger Logger = &LokiLogger{}
	assert.NotNil(t, logger)
}

func TestLokiLoggerPushFormat(t *testing.T) {
	var mu sync.Mutex
	var gotReq push.PushRequest

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, protoContentType, r.Header.Get("Content-Type"))
		assert.Equal(t, snappyContentEncoding, r.Header.Get("Content-Encoding"))
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		mu.Lock()
		gotReq = decodePushRequest(t, body)
		mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	logger, err := NewLokiLogger(LokiLoggerConfig{URL: server.URL})
	require.NoError(t, err)

	ts := time.Unix(1700000000, 0).UTC()
	labels := model.LabelSet{"service_name": "test-service", "level": "info"}
	require.NoError(t, logger.Handle(labels, ts, "hello loki"))
	logger.Stop()

	mu.Lock()
	defer mu.Unlock()
	require.Len(t, gotReq.Streams, 1)
	assert.Equal(t, labels.String(), gotReq.Streams[0].Labels)
	require.Len(t, gotReq.Streams[0].Entries, 1)
	assert.Equal(t, "hello loki", gotReq.Streams[0].Entries[0].Line)
	assert.True(t, ts.Equal(gotReq.Streams[0].Entries[0].Timestamp))
}

func TestLokiLoggerTenantHeader(t *testing.T) {
	var tenant string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenant = r.Header.Get("X-Scope-OrgID")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	logger, err := NewLokiLogger(LokiLoggerConfig{
		URL:      server.URL,
		TenantID: "tenant-42",
	})
	require.NoError(t, err)
	require.NoError(t, logger.Handle(model.LabelSet{"app": "demo"}, time.Now(), "msg"))
	logger.Stop()

	assert.Equal(t, "tenant-42", tenant)
}

func TestLokiLoggerBasicAuth(t *testing.T) {
	var authHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	logger, err := NewLokiLogger(LokiLoggerConfig{
		URL:      server.URL,
		TenantID: "tenant-42",
		Token:    "secret-token",
	})
	require.NoError(t, err)
	require.NoError(t, logger.Handle(model.LabelSet{"app": "demo"}, time.Now(), "msg"))
	logger.Stop()

	expected := "Basic " + base64.StdEncoding.EncodeToString([]byte("tenant-42:secret-token"))
	assert.Equal(t, expected, authHeader)
}

func TestLokiLoggerStopFlushesPendingEntries(t *testing.T) {
	received := make(chan struct{}, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- struct{}{}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	logger, err := NewLokiLogger(LokiLoggerConfig{URL: server.URL})
	require.NoError(t, err)
	require.NoError(t, logger.Handle(model.LabelSet{"app": "demo"}, time.Now(), "pending"))
	logger.Stop()

	select {
	case <-received:
	case <-time.After(2 * time.Second):
		t.Fatal("expected Stop() to flush pending entries")
	}
}

func TestLokiLoggerHandleWithMetadata(t *testing.T) {
	var gotReq push.PushRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		gotReq = decodePushRequest(t, body)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	logger, err := NewLokiLogger(LokiLoggerConfig{URL: server.URL})
	require.NoError(t, err)

	metadata := push.LabelsAdapter{
		{Name: "trace_id", Value: "abc123"},
	}
	require.NoError(t, logger.HandleWithMetadata(
		model.LabelSet{"app": "demo"},
		time.Now(),
		"with metadata",
		metadata,
	))
	logger.Stop()

	require.Len(t, gotReq.Streams, 1)
	require.Len(t, gotReq.Streams[0].Entries, 1)
	entry := gotReq.Streams[0].Entries[0]
	assert.Equal(t, "with metadata", entry.Line)
	require.Len(t, entry.StructuredMetadata, 1)
	assert.Equal(t, "trace_id", entry.StructuredMetadata[0].Name)
	assert.Equal(t, "abc123", entry.StructuredMetadata[0].Value)
}

func TestNewLokiLoggerRequiresURL(t *testing.T) {
	_, err := NewLokiLogger(LokiLoggerConfig{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "URL is required")
}
