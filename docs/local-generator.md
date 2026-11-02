# Local development data

The shared generator source and backend configuration live in `drilldown/generator`,
outside this project's npm dependencies. See the [shared guide](../../drilldown/generator/README.md).

Set the generator directory in this project's `.env` for your checkout layout:

```dotenv
DRILLDOWN_GENERATOR_DIR=../drilldown/generator
```

That is also the default when unset. An absolute directory path works too.
The existing Compose files include its `compose.yaml` and resolve build and config
paths there. Use the same commands as before:

```bash
pnpm server
# Or pnpm start for the plugin build, Docker stack, and foreground watcher.
pnpm server:down
```

The equivalent direct commands still work:

```bash
docker compose -f docker-compose.local.yaml up --build
docker compose -f docker-compose.local.yaml down
```

Stop the watcher with Ctrl+C. `start:all` retains the sibling app mounts and needs
their built apps. Install the shared AI skills using the guide for one-command
setup. Normal teardown preserves named data volumes. Docker Grafana uses
`host.docker.internal` and Loki tenant `1`. Do not start a second backend stack on
the same published ports; use an existing frontend-only mode when attaching to
backends already running.
