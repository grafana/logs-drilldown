package main

import (
	"context"
	"flag"
	"fmt"
	stdlog "log"
	"log/syslog"
	"net"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/grafana/explore-logs/generator/log"
	"github.com/grafana/explore-logs/generator/trace"
	"github.com/grafana/loki-client-go/loki"
	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
)

func main() {
	url := flag.String("url", "http://localhost:3100/loki/api/v1/push", "Loki URL")
	traceURL := flag.String("trace-url", "", "Tempo OTLP gRPC endpoint (e.g. localhost:4317) to emit spans so trace IDs match logs")
	dry := flag.Bool("dry", false, "Dry run: log to stdout instead of Loki")
	useOtel := flag.Bool("otel", true, "Ship logs for otel apps to OTel collector")
	tenantId := flag.String("tenant-id", "", "Loki tenant ID")
	token := flag.String("token", "", "GEL token")

	useSyslog := flag.Bool("syslog", false, "Output RFC5424 formatted logs to syslog instead of stdout")
	syslogProtocol := flag.String("syslog-network", "udp", "Syslog network type: 'udp' or 'tcp'")
	syslogAddr := flag.String("syslog-addr", "127.0.0.1:514", "Syslog remote address (e.g., '127.0.0.1:514')")

	flag.Parse()

	if os.Getenv("GENERATOR_FULL_DATA") == "1" {
		stdlog.Print("generator: GENERATOR_FULL_DATA=1, using full clusters/pods for all services (CI mode)")
	} else {
		stdlog.Print("generator: service-tiered mode (docker-compose-local-all), E2E-critical services get full data")
	}

	cfg, err := loki.NewDefaultConfig(*url)
	if err != nil {
		panic(err)
	}
	cfg.BackoffConfig.MaxRetries = 1
	cfg.BackoffConfig.MinBackoff = 100 * time.Millisecond
	cfg.BackoffConfig.MaxBackoff = 100 * time.Millisecond

	if *tenantId != "" {
		cfg.TenantID = *tenantId
	}

	if *token != "" {
		t := config.Secret(*token)
		cfg.Client.BasicAuth = &config.BasicAuth{
			Username: *tenantId,
			Password: t,
		}
	}

	client, err := loki.New(cfg)
	if err != nil {
		panic(err)
	}
	defer client.Stop()

	traceEmitter := trace.NewEmitter(*traceURL)
	if traceEmitter != nil {
		defer func() { _ = traceEmitter.Shutdown(context.Background()) }()
	}

	var logger log.Logger = client
	if traceEmitter != nil && !log.IsFullDataMode() {
		logger = log.NewTraceAwareLogger(logger, traceEmitter, true) // append for Loki line filter
	}

	// Configure the output based on flags, dry trumps all
	if *dry {
		// Use stdout for output
		logger = log.LoggerFunc(func(labels model.LabelSet, timestamp time.Time, message string, metadata push.LabelsAdapter) error {
			fmt.Println(labels, timestamp, message, metadata)
			return nil
		})
	} else if *useSyslog {
		conn, err := net.Dial(*syslogProtocol, *syslogAddr)
		if err != nil {
			panic(err)
		}
		defer conn.Close()
		logger = log.NewSyslogLogger(conn, syslog.LOG_INFO|syslog.LOG_DAEMON)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	// Creates and starts all apps.
	for namespace, apps := range generators {
		for serviceName, generator := range apps {
			log.ForAllClusters(
				namespace,
				serviceName,
				func(labels model.LabelSet, metadata push.LabelsAdapter) {
					// Remove `metadata` from nginx logs
					if serviceName == "nginx" {
						metadata = push.LabelsAdapter{}
					}
					var appLogger *log.AppLogger
					if strings.Contains(string(serviceName), "-otel") {
						if !*useOtel {
							return
						}
						var otelLogger log.Logger = log.NewOtelLogger(string(serviceName), labels)
						if traceEmitter != nil && !log.IsFullDataMode() {
							otelLogger = log.NewTraceAwareLogger(otelLogger, traceEmitter, false) // no append: trace_id in attributes, avoids breaking ParseJSON
						}
						appLogger = log.NewAppLogger(labels, otelLogger)
					} else {
						appLogger = log.NewAppLogger(labels, logger)
					}
					if log.UseFullDataForService(serviceName) {
						if log.IsFullDataMode() {
							appLogger.SetSleep(log.LogSleepOriginal)
						} else {
							appLogger.SetSleep(log.LogSleepFast)
						}
					}
					generator(ctx, appLogger, metadata)
				},
			)
		}
	}
	startFailingMimirPod(ctx, logger)

	<-ctx.Done()
}
