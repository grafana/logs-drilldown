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

	staticStart := flag.String("static-start", "", "Enable static (deterministic) mode. RFC3339 timestamp marking the start of the data window (e.g. 2025-05-26T11:00:00Z). When set, the generator emits a fixed amount of data inside [start, start+duration] and exits.")
	staticDuration := flag.Duration("static-duration", 65*time.Minute, "Static mode: duration of the data window starting at -static-start")
	staticStep := flag.Duration("static-step", 5*time.Second, "Static mode: virtual time advanced per log iteration")
	staticThrottle := flag.Duration("static-throttle", 100*time.Microsecond, "Static mode: real-time pause between iterations to avoid overwhelming Loki")
	staticDrain := flag.Duration("static-drain", 10*time.Second, "Static mode: extra time to wait for in-flight pushes after generators finish")
	staticSeed := flag.Int64("seed", 42, "Static mode: seed used for math/rand and gofakeit so generated data is reproducible")

	flag.Parse()

	if *staticStart != "" {
		start, err := time.Parse(time.RFC3339, *staticStart)
		if err != nil {
			stdlog.Fatalf("generator: invalid -static-start %q: %v", *staticStart, err)
		}
		if *staticDuration <= 0 {
			stdlog.Fatalf("generator: -static-duration must be positive, got %s", *staticDuration)
		}
		log.EnableStatic(log.StaticConfig{
			Start:    start.UTC(),
			End:      start.UTC().Add(*staticDuration),
			Step:     *staticStep,
			Throttle: *staticThrottle,
		}, *staticSeed)
		stdlog.Printf("generator: static mode enabled: window=[%s,%s] step=%s seed=%d", start.UTC().Format(time.RFC3339), start.UTC().Add(*staticDuration).Format(time.RFC3339), *staticStep, *staticSeed)
	} else if os.Getenv("GENERATOR_CI_DATA") == "1" {
		stdlog.Print("generator: GENERATOR_CI_DATA=1, using full clusters/pods for all services (CI mode)")
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
	if traceEmitter != nil && !log.IsCIData() && !log.StaticEnabled() {
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
						if traceEmitter != nil && !log.IsCIData() && !log.StaticEnabled() {
							otelLogger = log.NewTraceAwareLogger(otelLogger, traceEmitter, false) // no append: trace_id in attributes, avoids breaking ParseJSON
						}
						appLogger = log.NewAppLogger(labels, otelLogger)
					} else {
						appLogger = log.NewAppLogger(labels, logger)
					}
					if log.UseFullDataForService(serviceName) {
						if log.IsCIData() {
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

	if log.StaticEnabled() {
		// Wait for every spawned generator goroutine to finish, then give the
		// Loki client a few seconds to flush in-flight pushes before main
		// returns and the deferred client.Stop() runs.
		log.WaitGenerators()
		stdlog.Printf("generator: static mode generators finished; draining for %s", *staticDrain)
		time.Sleep(*staticDrain)
		stop()
		return
	}

	<-ctx.Done()
}
