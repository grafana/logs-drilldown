# Generative AI Contribution Policy

Generative AI (GenAI) tools such as large language model (LLM) assistants can help you write code, documentation, and proposals for Grafana Logs Drilldown. This policy explains what is an acceptable use of GenAI tools when contributing to the project.

## Core principle

**The human contributor is always in control and fully responsible for their contribution.**

GenAI is a tool that assists you. It is not a substitute for your own understanding, judgment, or accountability. By submitting a contribution, you vouch for it as your own work, regardless of which tools helped you produce it. You are expected to understand, review, and provide rationale for everything you submit.

## Acceptable use

You are welcome to use GenAI tools to:

- Write or refactor code and documentation, as long as you actively review and refine the output.
- Understand the Logs Drilldown codebase, Grafana Scenes, Loki, or LogQL before contributing or reviewing.
- Draft issues, proposals, or design documents that you then verify and shape into your own reasoning.
- Suggest tests, formatting, or lint fixes that you verify locally with `pnpm lint`, `pnpm typecheck`, and `pnpm test:ci`.

In all cases, you remain the author. You read the output, you correct it, and you ensure your contribution meets the project's standards before submitting an issue, pull request, or comment.

## Not acceptable

Do not:

- Submit unreviewed, bulk AI-generated content to pull requests, issues, or proposals. If you did not read and understand it, do not submit it.
- Use GenAI as a substitute for human judgment in code review. An AI tool may help you understand a change, but the review and its conclusions must be yours.
- File automated, bot-driven issues or pull requests from tools that have not been approved by the Logs Drilldown team. This policy covers humans using AI assistance, not autonomous agents acting on their own, including agentic IDE tools that file pull requests without human review.
- Paste generated text into a discussion without adding your own analysis and context.
- Wire up an AI agent to respond automatically to reviewers or other community members on your behalf. If you want help from GenAI in a discussion, use it yourself and post in your own words, rather than connecting it directly to maintainers.
- Submit pull requests without using the [pull request template](../.github/pull_request_template.md), or file bugs without reproduction steps and expected vs actual behavior.

Maintainers may close low-effort AI-generated contributions. When they do, they should explain why and, where appropriate, offer guidance on how to improve the contribution. Repeated low-effort submissions will trigger stricter review, and maintainers may block repeat offenders from contributing.

## Approved automation

Some automated tools are explicitly approved and are an acceptable exception to the rule against bot-driven contributions. Examples include Dependabot, Copilot, release-please, and other repository automation maintained by the team. The team may approve more over time. Contributions from these tools are clearly marked as bot-generated so that reviewers can tell them apart from human contributions.

## Disclosure

When GenAI generates the **bulk** of a contribution, disclose it. For pull requests, check the **"This pull request was substantially generated with AI assistance"** box in the [pull request template](../.github/pull_request_template.md). For issues, use the optional AI disclosure in the [bug](../.github/ISSUE_TEMPLATE/bug_report.md) or [feature](../.github/ISSUE_TEMPLATE/feature_request.md) template. Minor, incidental help such as autocomplete or small edits does not need to be disclosed.

Disclosure is not a mark against your contribution. It helps reviewers know where to focus, and it keeps expectations clear for everyone.

## Logs Drilldown-specific guidance

LLMs frequently hallucinate LogQL syntax, Grafana Scenes APIs, Loki lookup behavior, and patterns API semantics. To reduce these errors, point the tool at authoritative sources rather than relying on its training data:

- [AGENTS.md][agents] for architecture, Scenes patterns, and expected vs buggy behavior (including indexed labels and the Patterns API).
- [docs/sources/][user-docs] for user-facing feature documentation (patterns, labels, fields, troubleshooting).
- [Loki documentation][loki-docs] and [LogQL][logql-docs] for log search and query semantics.

Always validate AI-generated code against the real component definitions and the project's checks before submitting. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test:ci` locally. Use `pnpm lint:fix` for formatting when appropriate; do not commit unrelated drive-by changes.

### Tests and formatting

- Add tests that cover behavior you changed. Do not paste large blocks of shallow or incorrect AI-generated tests just to increase coverage.
- Prefer focused Jest unit tests or Playwright E2E when UI flows are affected.
- Match existing conventions in surrounding code. Keep scope tight — avoid unrelated refactors, new dependencies, or edits under `.config/` unless required and agreed.

### User-facing strings

New or changed UI copy must use translation keys (`t`, `Trans` from `@grafana/i18n`), not hard-coded strings. After editing copy, run `pnpm i18n-extract` and commit the updated `src/locales/en-US/grafana-lokiexplore-app.json`. CI verifies i18n markup; other locales are synced via Crowdin after merge to `main`.

For larger changes or new features, file an [issue][new-issue] first so we can discuss scope. A proposal must reflect your own reasoning. AI may help you draft it, but you own the argument in the discussion.

### Guidance for AI agents

If you use an agentic tool, point it at [AGENTS.md][agents] first. Agents should prefer small, focused diffs; grep before reading entire large files; and respect frontend security practices (sanitized HTML/URLs, no unsafe DOM APIs).

[agents]: ../AGENTS.md
[user-docs]: sources/
[loki-docs]: https://grafana.com/docs/loki/latest/
[logql-docs]: https://grafana.com/docs/loki/latest/query/
[new-issue]: https://github.com/grafana/logs-drilldown/issues/new
