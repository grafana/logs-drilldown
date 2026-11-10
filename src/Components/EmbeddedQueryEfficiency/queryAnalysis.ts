import {
  Json,
  JsonExpressionParser,
  LabelParser,
  LineFilter,
  LogfmtExpressionParser,
  LogfmtParser,
  Matcher,
  Nre,
  PipeMatch,
  Re,
  Regexp,
  Selector,
  String as StringNode,
} from '@grafana/lezer-logql';
import { SyntaxNode } from '@lezer/common';

import { EfficiencyCheck, levelForScore } from './scoring';
import { getNodesFromQuery } from 'services/logqlMatchers';

interface StructuralFinding {
  check: EfficiencyCheck;
  score: number;
}

const GOOD = 100;
const WARNING = 60;
const POOR = 20;

// A regex pattern that starts with an open-ended wildcard (e.g. ".*foo", "^.*foo"). Loki's index
// can't use it to narrow down streams, so it falls back to scanning every stream in the selector.
const LEADING_WILDCARD = /^\^?\.[*+]/;

const ALL_PARSER_TYPES = [LabelParser, LogfmtParser, JsonExpressionParser, LogfmtExpressionParser];

function isWithin(inner: SyntaxNode, outer: SyntaxNode): boolean {
  return inner.from >= outer.from && inner.to <= outer.to;
}

// getNodesFromQuery walks the whole query; some node types (Re/Nre, the regex operators) are
// reused by both the stream selector and line filters, so callers scope the result to one
// specific stage by range containment rather than relying on type alone.
function nodesWithin(query: string, typeIds: number[], outer: SyntaxNode): SyntaxNode[] {
  return getNodesFromQuery(query, typeIds).filter((node) => isWithin(node, outer));
}

function stringNodeText(query: string, node: SyntaxNode): string {
  return query.substring(node.from, node.to).replace(/^["`]|["`]$/g, '');
}

function finding(id: string, title: string, detail: string, score: number): StructuralFinding {
  return { check: { detail, id, status: levelForScore(score), title }, score };
}

// Loki best practice: exact label matches (=/!=) are a direct index lookup; regex matches (=~/!~),
// especially ones with a leading wildcard, can't be narrowed by the index and force a broader scan.
function checkSelectorMatchers(query: string): StructuralFinding | null {
  const [selector] = getNodesFromQuery(query, [Selector]);
  if (!selector) {
    return null;
  }

  const matchers = nodesWithin(query, [Matcher], selector);
  const regexMatchers = matchers.filter((matcher) => nodesWithin(query, [Re, Nre], matcher).length > 0);

  if (regexMatchers.length === 0) {
    return finding(
      'selector-matcher-type',
      'Stream selector matchers',
      "Uses exact label matches, which Loki's index can look up directly.",
      GOOD
    );
  }

  const hasUnanchoredRegex = regexMatchers.some((matcher) => {
    const [value] = nodesWithin(query, [StringNode], matcher);
    return value !== undefined && LEADING_WILDCARD.test(stringNodeText(query, value));
  });

  if (hasUnanchoredRegex) {
    return finding(
      'selector-matcher-type',
      'Stream selector matchers',
      'Uses a regex label matcher with a leading wildcard (e.g. ".*foo"). The index can\'t narrow this down, so it falls back to scanning every stream. Anchor the pattern or switch to an exact match.',
      POOR
    );
  }

  return finding(
    'selector-matcher-type',
    'Stream selector matchers',
    'Uses a regex label matcher (=~/!~). Exact matches (=/!=) are cheaper for Loki to look up in the index; use regex only when an exact match will not work.',
    WARNING
  );
}

// Loki best practice: line filters are cheap byte matches and should run before any parser stage,
// so expensive parsing only happens on lines that already passed the filter.
function checkFilterOrder(query: string): StructuralFinding | null {
  const lineFilters = getNodesFromQuery(query, [LineFilter]);
  const parsers = getNodesFromQuery(query, ALL_PARSER_TYPES);
  if (lineFilters.length === 0 || parsers.length === 0) {
    return null;
  }

  const firstParserStart = Math.min(...parsers.map((p) => p.from));
  const hasFilterAfterParser = lineFilters.some((f) => f.from > firstParserStart);

  if (hasFilterAfterParser) {
    return finding(
      'filter-order',
      'Filter and parser order',
      'A line filter runs after a parser stage. Line filters are cheap byte matches — move them before `| json`/`| logfmt`/etc. so parsing only runs on lines that already matched.',
      POOR
    );
  }

  return finding(
    'filter-order',
    'Filter and parser order',
    'Line filters run before parsing, so only matching lines get parsed.',
    GOOD
  );
}

// Loki best practice: exact line filters (|=/!=) are matched faster than regex filters (|~/!~).
function checkLineFilterType(query: string): StructuralFinding | null {
  const lineFilters = getNodesFromQuery(query, [LineFilter]);
  if (lineFilters.length === 0) {
    return null;
  }

  const hasRegexFilter = lineFilters.some((f) => nodesWithin(query, [PipeMatch, Nre], f).length > 0);

  if (hasRegexFilter) {
    return finding(
      'line-filter-type',
      'Line filter type',
      'Uses a regex line filter (|~/!~). Loki matches exact filters (|=/!=) faster; use regex only when a plain substring will not work.',
      WARNING
    );
  }

  return finding(
    'line-filter-type',
    'Line filter type',
    'Uses exact line filters (|=/!=), which Loki matches faster than regular expressions.',
    GOOD
  );
}

// Loki best practice: prefer json/logfmt over regexp (the most expensive parser), and scope
// json/logfmt to the fields actually needed (`| json field1, field2`) instead of extracting all of them.
function checkParserCost(query: string): StructuralFinding | null {
  const parsers = getNodesFromQuery(query, ALL_PARSER_TYPES);
  if (parsers.length === 0) {
    return null;
  }

  if (getNodesFromQuery(query, [Regexp]).length > 0) {
    return finding(
      'parser-cost',
      'Parser cost',
      'Uses the regexp parser, the most expensive parser stage. Prefer json/logfmt if the log format fits, or pattern if a custom parser is needed.',
      WARNING
    );
  }

  const hasUnscopedJson = getNodesFromQuery(query, [LabelParser]).some((p) => nodesWithin(query, [Json], p).length > 0);
  const hasUnscopedLogfmt = getNodesFromQuery(query, [LogfmtParser]).length > 0;

  if (hasUnscopedJson || hasUnscopedLogfmt) {
    return finding(
      'parser-cost',
      'Parser cost',
      'Extracts every field from each line. If only a few fields are needed downstream, scope the parser (e.g. `| json field1, field2`) to skip extracting the rest.',
      WARNING
    );
  }

  return finding('parser-cost', 'Parser cost', 'Uses a scoped or lightweight parser stage.', GOOD);
}

// Static analysis of the query's structure, independent of the stats endpoint: stream selector
// matcher type, pipeline stage ordering, and parser choice. See Loki's query best-practices docs.
export function analyzeQuery(query: string): { checks: EfficiencyCheck[]; score: number } {
  const findings = [checkSelectorMatchers(query), checkFilterOrder(query), checkLineFilterType(query), checkParserCost(query)].filter(
    (f): f is StructuralFinding => f !== null
  );

  if (findings.length === 0) {
    return { checks: [], score: GOOD };
  }

  return {
    checks: findings.map((f) => f.check),
    score: Math.min(...findings.map((f) => f.score)),
  };
}
