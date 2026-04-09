# Start with the OTEL collector stage
FROM otel/opentelemetry-collector-contrib:latest@sha256:b14234c4bc1b7364629af272e564913bb57bdc9736d45b8b6db5ab3417dc75f9 AS collector

# Final stage
FROM golang:1.25@sha256:fad20fab2cedf5eef7c4585c69eff354aaa5e4a4e848768e82432be273b2c950

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

# Wait a bit for collector to start
sleep 2

# Start the log generator
/generator \$@
EOF

# Install envsubst utility
RUN apt-get update && apt-get install -y gettext-base && rm -rf /var/lib/apt/lists/*

RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
