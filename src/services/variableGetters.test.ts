import { getParserEnabled } from './parserToggle';
import { getLogsStreamSelector } from './variableGetters';
import {
  LOGS_FORMAT_EXPR,
  LogsQueryOptions,
  VAR_FIELDS_EXPR,
  VAR_JSON_FIELDS_EXPR,
  VAR_LABELS_EXPR,
  VAR_LEVELS_EXPR,
  VAR_LINE_FILTERS_EXPR,
  VAR_METADATA_EXPR,
  VAR_PATTERNS_EXPR,
} from './variables';

jest.mock('./parserToggle');

const getParserEnabledMock = jest.mocked(getParserEnabled);

describe('getLogsStreamSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getParserEnabledMock.mockReturnValue(true);
  });

  describe('when parsers are enabled', () => {
    test('builds the structuredMetadata selector without a parser stage', () => {
      const expr = getLogsStreamSelector({ parser: 'structuredMetadata' });

      expect(expr).toBe(
        `{${VAR_LABELS_EXPR}}  ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR}  ${VAR_FIELDS_EXPR}`
      );
      expect(expr).not.toContain('| json');
      expect(expr).not.toContain('| logfmt');
    });

    test('builds the json selector with the json parser stage', () => {
      const expr = getLogsStreamSelector({ parser: 'json' });

      expect(expr).toBe(
        `{${VAR_LABELS_EXPR}}  ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} | json  ${VAR_JSON_FIELDS_EXPR} | drop __error__, __error_details__  ${VAR_FIELDS_EXPR}`
      );
      expect(expr).toContain('| json');
      expect(expr).toContain('| drop __error__, __error_details__');
    });

    test('builds the logfmt selector with the logfmt format stage', () => {
      const expr = getLogsStreamSelector({ parser: 'logfmt' });

      expect(expr).toBe(
        `{${VAR_LABELS_EXPR}}  ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${LOGS_FORMAT_EXPR}  ${VAR_FIELDS_EXPR}`
      );
      expect(expr).toContain(LOGS_FORMAT_EXPR);
    });

    test('falls back to the mixed json + logfmt selector for an unknown parser', () => {
      const expr = getLogsStreamSelector({ parser: undefined });

      expect(expr).toBe(
        `{${VAR_LABELS_EXPR}}  ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} | json  ${VAR_JSON_FIELDS_EXPR} | logfmt | drop __error__, __error_details__   ${VAR_FIELDS_EXPR}`
      );
      expect(expr).toContain('| json');
      expect(expr).toContain('| logfmt');
    });

    test('interpolates the additional expression fragments into the selector', () => {
      const options: LogsQueryOptions = {
        fieldExpressionToAdd: '| foo="bar"',
        jsonParserPropToAdd: 'level="error"',
        labelExpressionToAdd: ', service="api"',
        parser: 'json',
        structuredMetadataToAdd: '| trace_id="abc"',
      };

      const expr = getLogsStreamSelector(options);

      expect(expr).toBe(
        `{${VAR_LABELS_EXPR}, service="api"} | trace_id="abc" ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} | json level="error" ${VAR_JSON_FIELDS_EXPR} | drop __error__, __error_details__ | foo="bar" ${VAR_FIELDS_EXPR}`
      );
    });

    test('defaults all optional fragments to empty strings', () => {
      const expr = getLogsStreamSelector({});

      // No parser supplied -> default branch with the mixed json + logfmt stage.
      expect(expr).toBe(
        `{${VAR_LABELS_EXPR}}  ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} | json  ${VAR_JSON_FIELDS_EXPR} | logfmt | drop __error__, __error_details__   ${VAR_FIELDS_EXPR}`
      );
    });
  });

  describe('when parsers are disabled', () => {
    beforeEach(() => {
      getParserEnabledMock.mockReturnValue(false);
    });

    test.each(['json', 'logfmt', undefined] as const)(
      'drops the parser stage and uses the structuredMetadata selector for parser "%s"',
      (parser) => {
        const expr = getLogsStreamSelector({ parser });

        expect(expr).toBe(
          `{${VAR_LABELS_EXPR}}  ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR}  ${VAR_FIELDS_EXPR}`
        );
        expect(expr).not.toContain('| json');
        expect(expr).not.toContain('| logfmt');
      }
    );

    test('still interpolates label and field fragments while omitting the parser stage', () => {
      const expr = getLogsStreamSelector({
        fieldExpressionToAdd: '| foo="bar"',
        labelExpressionToAdd: ', service="api"',
        parser: 'json',
        structuredMetadataToAdd: '| trace_id="abc"',
      });

      expect(expr).toBe(
        `{${VAR_LABELS_EXPR}, service="api"} | trace_id="abc" ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} | foo="bar" ${VAR_FIELDS_EXPR}`
      );
    });
  });
});
