package log

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	sdk "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// OtelLogger implements the Logger interface and provides OpenTelemetry context awareness
type OtelLogger struct {
	logger *slog.Logger
}

// NewOtelLogger creates a new OpenTelemetry-aware logger
func NewOtelLogger(svcName string, labels model.LabelSet) *OtelLogger {
	provider, err := loggingProvider(svcName, labels)
	if err != nil {
		return nil
	}
	return &OtelLogger{
		logger: otelslog.NewLogger("log-generator", otelslog.WithLoggerProvider(provider)),
	}
}

// Handle implements the Logger interface
func (o *OtelLogger) Handle(labels model.LabelSet, timestamp time.Time, message string) error {
	return o.HandleWithMetadata(labels, timestamp, message, nil)
}

// HandleWithMetadata implements the Logger interface with OpenTelemetry context
func (o *OtelLogger) HandleWithMetadata(labels model.LabelSet, timestamp time.Time, message string, metadata push.LabelsAdapter) error {
	// Convert labels to slog attributes
	attrs := make([]slog.Attr, 0, len(labels)+3) // +3 for potential trace context

	// Add all labels as attributes
	for k, v := range labels {
		// Skip indexed labels, they've already been added as resource attributes
		switch k {
		case "cluster", "namespace", "env", "service_name":
			continue
		}

		attrs = append(attrs, slog.String(string(k), string(v)))
	}

	//
	// Add metadata if present
	if metadata != nil {
		for _, label := range metadata {
			attrs = append(attrs, slog.String(label.Name, label.Value))
		}
	}

	// Extract trace context if available
	if traceID := extractTraceID(metadata); traceID != "" {
		attrs = append(attrs, slog.String("trace_id", traceID))
	}

	// Determine log level from labels
	level := getSlogLevel(labels)

	// Create the log record
	record := slog.NewRecord(timestamp, level, message, 0)
	record.AddAttrs(attrs...)

	// Log the record
	return o.logger.Handler().Handle(context.Background(), record)
}

// extractTraceID attempts to get trace ID from metadata
func extractTraceID(metadata push.LabelsAdapter) string {
	if metadata == nil {
		return ""
	}

	for _, label := range metadata {
		if label.Name == "traceID" {
			return label.Value
		}
	}
	return ""
}

// getSlogLevel converts Loki log levels to slog levels
func getSlogLevel(labels model.LabelSet) slog.Level {
	if level, ok := labels["level"]; ok {
		switch level {
		case "error":
			return slog.LevelError
		case "warn":
			return slog.LevelWarn
		case "info":
			return slog.LevelInfo
		case "debug":
			return slog.LevelDebug
		}
	}
	return slog.LevelInfo
}

func loggingProvider(svcName string, labels model.LabelSet) (*sdk.LoggerProvider, error) {
	ctx := context.Background()

	// Get collector endpoint from env var or use default
	collectorEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if collectorEndpoint == "" {
		collectorEndpoint = "localhost:4317"
	}

	// Create gRPC connection to collector
	conn, err := grpc.NewClient(collectorEndpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))

	if err != nil {
		return nil, fmt.Errorf("failed to connect to collector: %w", err)
	}

	var cluster, namespace, env string
	for k, v := range labels {
		switch k {
		case "cluster":
			cluster = string(v)
		case "namespace":
			namespace = string(v)
		case "env":
			env = string(v)
		}
	}

	// Create resource with service information and indexed labels
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(svcName),
			semconv.ServiceVersion("1.0.0"),
			semconv.K8SNamespaceName(namespace),
			semconv.K8SClusterName(cluster),
			semconv.DeploymentEnvironment(env),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create OTLP exporter
	exporter, err := otlploggrpc.New(ctx,
		otlploggrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, fmt.Errorf("failed to create log exporter: %w", err)
	}
	proc := sdk.NewBatchProcessor(exporter)

	// Create logger provider
	return sdk.NewLoggerProvider(sdk.WithResource(res), sdk.WithProcessor(proc)), nil
}
