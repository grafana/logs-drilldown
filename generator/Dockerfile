# Start with the OTEL collector stage
FROM otel/opentelemetry-collector-contrib:latest@sha256:4a951ff0a9772f4fa8e9c7a326434370301b98b2b813933468dcb54aa6a6b5e5 AS collector

# Final stage
FROM golang:1.24@sha256:5034fa44b36163a4109b71ed75c67dbdcb52c3cd9750953befe00054315d9fd2

# Copy the collector binary from the collector stage
COPY --from=collector /otelcol-contrib /otelcol-contrib

WORKDIR /go/src/app

# Copy and build the log generator
COPY go.mod go.sum ./
COPY *.go ./
COPY flog/ flog/
COPY log/ log/

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

# Wait a bit for collector to start
sleep 2

# Start the log generator
/generator \$@
EOF

# Install envsubst utility
RUN apt-get update && apt-get install -y gettext-base && rm -rf /var/lib/apt/lists/*

RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
