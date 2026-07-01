# Grafana Logs Drilldown

The Grafana Logs Drilldown app lets users browse and visualize log data stored in Loki without complex queries.

We love accepting contributions! To help us create a safe and positive community experience, we require all participants to adhere to the [Grafana Code of Conduct](https://github.com/grafana/grafana/blob/main/CODE_OF_CONDUCT.md).

If your change is minor, please feel free to submit a [pull request](https://help.github.com/articles/about-pull-requests/). If your change is larger, or adds a feature, please file an issue beforehand so that we can discuss the change. You're welcome to file an implementation pull request immediately as well, although we generally lean towards discussing the change and then reviewing the implementation separately.

## Filing issues

Use [GitHub Issues](https://github.com/grafana/logs-drilldown/issues/new) to report bugs, ask questions, or propose larger changes.

| Situation                                                        | What to do                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bug** — something is broken or regressed                       | [Open a bug report](https://github.com/grafana/logs-drilldown/issues/new?template=bug_report.md) with reproduction steps, expected vs actual behavior, Grafana/Loki versions, and screenshots or recordings if helpful. |
| **Small fix** — typo, clear one-file change, docs tweak          | Open a pull request directly; link a related issue if one exists.                                                                                                                                                       |
| **Feature or larger change** — new UI, behavior change, refactor | [Open a feature request](https://github.com/grafana/logs-drilldown/issues/new?template=feature_request.md) to discuss scope, or open a draft PR with context in the description.                                        |
| **Documentation only**                                           | Open a PR and add the `type/doc` label.                                                                                                                                                                                 |

For bugs, check [Loki](https://grafana.com/docs/loki/latest/) and [LogQL](https://grafana.com/docs/loki/latest/query/) behavior first — for example, the Patterns API only supports stream selectors (indexed labels), so a label filter not applied to Patterns may be expected, not a plugin bug.

## Contribute to documentation

Have a great new feature you want to contribute? Add docs for it!
Find something missing in the docs? Update the docs!

Use the [Writer's Toolkit](https://grafana.com/docs/writers-toolkit/writing-guide/contribute-documentation/) for information on creating good documentation.
The toolkit also provides [document templates](https://github.com/grafana/writers-toolkit/tree/main/docs/static/templates) to help get started.

When you create a PR for documentation, add the `type/doc` label to identify the PR as contributing documentation.

To preview the documentation locally, run `pnpm docs` from the root folder of the Logs Drilldown repository. This uses
the `grafana/docs` image which internally uses Hugo to generate the static site. The site is available on `localhost:3002/docs/`.

> **Note** The `make docs` command uses a lot of memory. If it is crashing, make sure to increase the memory allocated to Docker
> and try again.

## Contribute code

### Development environment

1. Install dependencies: `pnpm install --frozen-lockfile --ignore-scripts`
2. Start the dev build: `pnpm dev` (or `pnpm start` to install and watch)
3. Run Grafana + Loki locally: `pnpm server` (Grafana at http://localhost:3000)

See [AGENTS.md](AGENTS.md) for architecture, Scenes patterns, and Loki/LogQL expectations. Plugin build and E2E details live in [`.config/AGENTS/instructions.md`](.config/AGENTS/instructions.md).

### Before you open a pull request

- Fill out the [pull request template](.github/pull_request_template.md) with a clear summary and test steps.
- Use a [conventional commit](https://www.conventionalcommits.org/) style PR title (enforced by CI).
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm test:ci` locally.
- Add or update tests when behavior changes. Prefer focused unit tests (Jest) or Playwright E2E when UI flows are affected.
- Do not modify files under `.config/` unless you are following the plugin-tools guidance in `.config/AGENTS/instructions.md`.

### Internationalization (i18n)

User-facing strings must use Grafana i18n APIs — `t` or `Trans` from `@grafana/i18n` with a stable `i18nKey`, not hard-coded text in components.

After adding or changing copy:

1. Run `pnpm i18n-extract` to update `src/locales/en-US/grafana-lokiexplore-app.json`.
2. Commit the extracted English locale file with your PR.

CI runs an i18n verification workflow on pull requests. Translations for other locales are managed via Crowdin and synced after changes merge to `main`; you do not need to hand-edit non-English locale files in most PRs.

## Using AI and coding assistants

Generative AI tools can help you explore the codebase, draft code, and write documentation. **You are always responsible for what you submit.**

Read the full [Generative AI Contribution Policy](docs/genai.md) for acceptable use, disclosure, Logs Drilldown-specific guidance (Loki, LogQL, Scenes, tests), and rules for agentic tools. Point coding assistants at [AGENTS.md](AGENTS.md) for technical conventions.

When AI generated the bulk of a pull request, check the disclosure box in the pull request template.
