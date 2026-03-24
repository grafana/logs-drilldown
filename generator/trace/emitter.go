package trace

import (
	"context"
	"log"
	"os"
	"strings"
	"sync"

	"github.com/prometheus/common/model"
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
// Uses per-service TracerProviders so span metrics get service=nginx-json-mixed etc., matching
// Loki's service_name for Metrics Drilldown "Related logs".
type Emitter struct {
	conn   *grpc.ClientConn
	mu     sync.RWMutex
	providers map[string]*sdktrace.TracerProvider
}

// NewEmitter creates a trace emitter that exports spans to the given endpoint (e.g. "tempo:4317").
// Returns nil if the endpoint is empty or connection fails.
func NewEmitter(endpoint string) *Emitter {
	if endpoint == "" {
		return nil
	}

	conn, err := grpc.NewClient(endpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("trace emitter: failed to connect to %s: %v", endpoint, err)
		return nil
	}

	log.Printf("trace emitter: connected to %s, spans will be exported to Tempo", endpoint)
	return &Emitter{
		conn:     conn,
		providers: make(map[string]*sdktrace.TracerProvider),
	}
}

func (e *Emitter) getProvider(serviceName string) *sdktrace.TracerProvider {
	e.mu.RLock()
	tp, ok := e.providers[serviceName]
	e.mu.RUnlock()
	if ok {
		return tp
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	if tp, ok := e.providers[serviceName]; ok {
		return tp
	}

	ctx := context.Background()
	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(e.conn))
	if err != nil {
		log.Printf("trace emitter: failed to create exporter for %s: %v", serviceName, err)
		return nil
	}

	tp = sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
		)),
	)
	e.providers[serviceName] = tp
	return tp
}

// EmitSpan creates a span and exports it to Tempo. Returns the trace ID to use in log metadata.
// The trace ID links the span (in Tempo) to logs (in Loki) for trace-to-logs.
// Uses serviceName as the resource service name so span metrics match Loki's service_name.
func (e *Emitter) EmitSpan(ctx context.Context, serviceName, spanName string, labels model.LabelSet) string {
	if e == nil || e.conn == nil {
		return ""
	}

	tp := e.getProvider(serviceName)
	if tp == nil {
		return ""
	}

	tracer := tp.Tracer("log-generator")
	_, span := tracer.Start(ctx, spanName)
	defer span.End()

	for k, v := range labels {
		span.SetAttributes(attribute.String(string(k), string(v)))
	}

	traceID := strings.ToLower(span.SpanContext().TraceID().String())
	if traceEmitterDebugLogging() {
		log.Printf("trace emitter: emitted span service=%s name=%s traceID=%s", serviceName, spanName, traceID)
	}
	return traceID
}

// Shutdown flushes and shuts down all tracer providers.
func (e *Emitter) Shutdown(ctx context.Context) error {
	if e == nil || e.conn == nil {
		return nil
	}
	log.Printf("trace emitter: shutting down, flushing pending spans")
	e.mu.Lock()
	providers := e.providers
	e.providers = make(map[string]*sdktrace.TracerProvider)
	e.mu.Unlock()

	var lastErr error
	for _, tp := range providers {
		if err := tp.Shutdown(ctx); err != nil {
			lastErr = err
			log.Printf("trace emitter: shutdown error: %v", err)
		}
	}
	_ = e.conn.Close()
	log.Printf("trace emitter: shutdown complete")
	return lastErr
}
