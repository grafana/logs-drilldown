package main

import (
	"context"
	"flag"
	"fmt"
	"log/syslog"
	"net"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/grafana/explore-logs/generator/log"
	"github.com/grafana/loki-client-go/loki"
	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
)

func main() {
	url := flag.String("url", "http://localhost:3100/loki/api/v1/push", "Loki URL")
	dry := flag.Bool("dry", false, "Dry run: log to stdout instead of Loki")
	useOtel := flag.Bool("otel", true, "Ship logs for otel apps to OTel collector")
	tenantId := flag.String("tenant-id", "", "Loki tenant ID")
	token := flag.String("token", "", "GEL token")

	useSyslog := flag.Bool("syslog", false, "Output RFC5424 formatted logs to syslog instead of stdout")
	syslogProtocol := flag.String("syslog-network", "udp", "Syslog network type: 'udp' or 'tcp'")
	syslogAddr := flag.String("syslog-addr", "127.0.0.1:514", "Syslog remote address (e.g., '127.0.0.1:514')")

	flag.Parse()

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

	var logger log.Logger = client

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
					if strings.Contains(string(serviceName), "-otel") {
						if !*useOtel {
							return
						}
						generator(
							ctx,
							log.NewAppLogger(
								labels,
								log.NewOtelLogger(string(serviceName), labels),
							),
							metadata,
						)
					} else {
						generator(ctx, log.NewAppLogger(labels, logger), metadata)
					}
				},
			)
		}
	}
	startFailingMimirPod(ctx, logger)

	<-ctx.Done()
}
