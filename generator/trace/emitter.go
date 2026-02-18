package trace

import (
	"context"
	"log"
	"os"
	"strings"

	"github.com/prometheus/common/model"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func traceEmitterDebugLogging() bool {
	return os.Getenv("TRACE_EMITTER_DEBUG") == "1" || os.Getenv("TRACE_EMITTER_DEBUG") == "true"
}

// Emitter creates spans and exports them to Tempo so trace IDs match between traces and logs.
type Emitter struct {
	tracer *sdktrace.TracerProvider
}

// NewEmitter creates a trace emitter that exports spans to the given endpoint (e.g. "tempo:4317").
// Returns nil if the endpoint is empty or connection fails.
func NewEmitter(endpoint string) *Emitter {
	if endpoint == "" {
		return nil
	}

	ctx := context.Background()
	conn, err := grpc.NewClient(endpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("trace emitter: failed to connect to %s: %v", endpoint, err)
		return nil
	}

	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
	if err != nil {
		log.Printf("trace emitter: failed to create exporter: %v", err)
		_ = conn.Close()
		return nil
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName("log-generator"),
		)),
	)

	otel.SetTracerProvider(tp)

	log.Printf("trace emitter: connected to %s, spans will be exported to Tempo", endpoint)
	return &Emitter{tracer: tp}
}

// EmitSpan creates a span and exports it to Tempo. Returns the trace ID to use in log metadata.
// The trace ID links the span (in Tempo) to logs (in Loki) for trace-to-logs.
func (e *Emitter) EmitSpan(ctx context.Context, serviceName, spanName string, labels model.LabelSet) string {
	if e == nil || e.tracer == nil {
		return ""
	}

	tracer := e.tracer.Tracer("log-generator")
	_, span := tracer.Start(ctx, spanName)
	defer span.End()

	span.SetAttributes(
		attribute.String(string(semconv.ServiceNameKey), serviceName),
	)
	for k, v := range labels {
		span.SetAttributes(attribute.String(string(k), string(v)))
	}

	traceID := strings.ToLower(span.SpanContext().TraceID().String())
	if traceEmitterDebugLogging() {
		log.Printf("trace emitter: emitted span service=%s name=%s traceID=%s", serviceName, spanName, traceID)
	}
	// Use lowercase to match common trace ID formats (e.g. Grafana, Loki)
	return traceID
}

// Shutdown flushes and shuts down the trace provider.
func (e *Emitter) Shutdown(ctx context.Context) error {
	if e == nil || e.tracer == nil {
		return nil
	}
	log.Printf("trace emitter: shutting down, flushing pending spans")
	err := e.tracer.Shutdown(ctx)
	if err != nil {
		log.Printf("trace emitter: shutdown error: %v", err)
		return err
	}
	log.Printf("trace emitter: shutdown complete")
	return nil
}
