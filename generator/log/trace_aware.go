package log

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/explore-logs/generator/trace"
	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
)

// TraceAwareLogger wraps a Logger and injects trace IDs from emitted spans into log metadata.
// This ensures trace IDs match between traces (in Tempo) and logs (in Loki) for trace-to-logs.
type TraceAwareLogger struct {
	underlying             Logger
	traceEmitter           *trace.Emitter
	appendTraceIDToMessage bool // false for OTel (trace_id in attributes); true for Loki (line filter)
}

// NewTraceAwareLogger returns a logger that creates spans before each log and uses the span's
// trace ID in metadata. If traceEmitter is nil, logs pass through unchanged.
// appendTraceIDToMessage: true for Loki (enables line filter |="traceId"); false for OTel (trace_id in attributes, avoids breaking ParseJSON in collector).
func NewTraceAwareLogger(underlying Logger, traceEmitter *trace.Emitter, appendTraceIDToMessage bool) *TraceAwareLogger {
	return &TraceAwareLogger{
		underlying:             underlying,
		traceEmitter:           traceEmitter,
		appendTraceIDToMessage: appendTraceIDToMessage,
	}
}

// Handle implements Logger.
func (t *TraceAwareLogger) Handle(labels model.LabelSet, timestamp time.Time, message string) error {
	return t.underlying.Handle(labels, timestamp, message)
}

// HandleWithMetadata implements Logger. Creates a span, exports to Tempo, and uses its trace ID in metadata.
// Also appends trace_id to the message so trace-to-logs line filters (|="$${__span.traceId}") can find logs.
func (t *TraceAwareLogger) HandleWithMetadata(labels model.LabelSet, timestamp time.Time, message string, metadata push.LabelsAdapter) error {
	if t.traceEmitter != nil && metadata != nil {
		serviceName := string(labels["service_name"])
		if serviceName == "" {
			serviceName = "unknown"
		}
		traceID := t.traceEmitter.EmitSpan(context.Background(), serviceName, "log", labels)
		metadata = MetadataWithTraceID(metadata, traceID)
		if traceID != "" && t.appendTraceIDToMessage {
			message = fmt.Sprintf("%s trace_id=%s", message, traceID)
		}
	}
	return t.underlying.HandleWithMetadata(labels, timestamp, message, metadata)
}
