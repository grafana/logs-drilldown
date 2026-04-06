import React from 'react';

import { t } from '@grafana/i18n';
import { EmptyState, TextLink } from '@grafana/ui';

import { PATTERNS_MAX_AGE_HOURS } from './PatternsBreakdownScene';

export const PatternsNotConfigured = () => {
  return (
    <EmptyState
      variant="not-found"
      message={t('logs.logs-drilldown.patterns.error-title', 'There are no pattern matches.')}
    >
      {t(
        'logs.logs-drilldown.patterns.error-message',
        'Pattern matching has not been configured. Patterns let you detect similar log lines and add or exclude them from your search. To see them in action, add the following to your Loki configuration.'
      )}
      <p>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings -- Loki config flag literal */}
        <code>--pattern-ingester.enabled=true</code>
      </p>
    </EmptyState>
  );
};

export const PatternsNotDetected = () => {
  return (
    <EmptyState
      variant="not-found"
      message={t('logs.logs-drilldown.patterns.not-detected-title', 'Sorry, we could not detect any patterns.')}
    >
      <p>
        {t('logs.logs-drilldown.patterns.not-detected-help-prefix', 'Check back later or reach out to the team in the')}{' '}
        <TextLink href="https://slack.grafana.com/" external>
          {t('logs.logs-drilldown.patterns.not-detected-help-link', 'Grafana Labs community Slack channel')}
        </TextLink>
        .{' '}
        {t(
          'logs.logs-drilldown.patterns.not-detected-description',
          'Patterns let you detect similar log lines to include or exclude from your search.'
        )}
      </p>
    </EmptyState>
  );
};

export const PatternsNoMatchingFilters = () => {
  return (
    <EmptyState
      variant="not-found"
      message={t('logs.logs-drilldown.patterns.no-match-filters-title', 'No patterns match these filters.')}
    />
  );
};

export const PatternsTooOld = () => {
  return (
    <EmptyState
      variant="not-found"
      message={t(
        'logs.logs-drilldown.patterns.too-old-title',
        'Patterns are only available for the most recent {{maxAgeHours}} hours of data.',
        { maxAgeHours: PATTERNS_MAX_AGE_HOURS }
      )}
    >
      <p>
        {t('logs.logs-drilldown.patterns.too-old-docs-prefix', 'See the')}{' '}
        <TextLink href="https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/patterns/" external>
          {t('logs.logs-drilldown.patterns.too-old-docs-link', 'patterns docs')}
        </TextLink>{' '}
        {t('logs.logs-drilldown.patterns.too-old-docs-suffix', 'for more info.')}
      </p>
    </EmptyState>
  );
};
