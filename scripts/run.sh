#!/bin/sh

mkdir -p /tmp/logs-drilldown/config
mkdir -p /tmp/logs-drilldown/provisioning/datasources
mkdir -p /tmp/logs-drilldown/provisioning/plugins

# Download files
curl https://raw.githubusercontent.com/grafana/logs-drilldown/main/config/loki-config.yaml -o /tmp/logs-drilldown/config/loki-config.yaml
curl https://raw.githubusercontent.com/grafana/logs-drilldown/main/config/loki-overrides.yaml -o /tmp/logs-drilldown/config/loki-overrides.yaml
curl https://raw.githubusercontent.com/grafana/logs-drilldown/main/provisioning/datasources/default.yaml -o /tmp/logs-drilldown/provisioning/datasources/default.yaml
curl https://raw.githubusercontent.com/grafana/logs-drilldown/main/provisioning/plugins/app.yaml -o /tmp/logs-drilldown/provisioning/plugins/app.yaml

curl https://raw.githubusercontent.com/grafana/logs-drilldown/main/docker-compose.yaml -o /tmp/logs-drilldown/docker-compose.yaml

docker compose -f /tmp/logs-drilldown/docker-compose.yaml up
