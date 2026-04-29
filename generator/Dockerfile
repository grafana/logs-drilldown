# Start with the OTEL collector stage
FROM otel/opentelemetry-collector-contrib:latest@sha256:b14234c4bc1b7364629af272e564913bb57bdc9736d45b8b6db5ab3417dc75f9 AS collector

# Final stage
FROM golang:1.26@sha256:b54cbf583d390341599d7bcbc062425c081105cc5ef6d170ced98ef9d047c716

# Copy the collector binary from the collector stage
COPY --from=collector /otelcol-contrib /otelcol-contrib

WORKDIR /go/src/app

# Copy and build the log generator
COPY go.mod go.sum ./
COPY *.go ./
COPY flog/ flog/
COPY log/ log/
COPY trace/ trace/

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /generator

# Copy the OTEL collector config
COPY otel-config.yaml /etc/otel/config.template.yaml

COPY <<EOF /start.sh
#!/bin/sh
# Set default OTLP endpoint if not provided
export OTLP_ENDPOINT=\${OTLP_ENDPOINT:-http://host.docker.internal:3100/otlp}

# Replace environment variables in the config template
envsubst < /etc/otel/config.template.yaml > /etc/otel/config.yaml

# Start the OTEL collector in the background
/otelcol-contrib --config /etc/otel/config.yaml &
COLLECTOR_PID=\$!

# Wait a bit for collector to start
sleep 2

# Start the log generator (foreground)
/generator \$@
GEN_EXIT=\$?

# In live mode the generator only exits when the container is stopped, so
# the kill below is effectively a no-op (collector already gone). In static
# mode the generator finishes after its bounded run; give the collector a
# moment to drain queued batches, then SIGTERM it for a clean shutdown.
sleep 3
kill -TERM \$COLLECTOR_PID 2>/dev/null || true
wait \$COLLECTOR_PID 2>/dev/null || true
exit \$GEN_EXIT
EOF

# Install envsubst utility
RUN apt-get update && apt-get install -y gettext-base && rm -rf /var/lib/apt/lists/*

RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
