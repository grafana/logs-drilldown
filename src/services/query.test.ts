import { AdHocVariableFilter } from '@grafana/data';

import { LineFilterCaseSensitive, LineFilterOp } from './filterTypes';
import { buildDataQuery, renderLogQLLineFilter, unwrapWildcardSearch, wrapWildcardSearch } from './query';

describe('buildDataQuery', () => {
  test('Given an expression outputs a Loki query', () => {
    expect(buildDataQuery('{place="luna"}')).toEqual({
      editorMode: 'code',
      expr: '{place="luna"}',
      queryType: 'range',
      refId: 'A',
      supportingQueryType: 'grafana-lokiexplore-app',
    });
  });

  test('Given an expression and overrides outputs a Loki query', () => {
    expect(buildDataQuery('{place="luna"}', { editorMode: 'gpt', refId: 'C' })).toEqual({
      editorMode: 'gpt',
      expr: '{place="luna"}',
      queryType: 'range',
      refId: 'C',
      supportingQueryType: 'grafana-lokiexplore-app',
    });
  });
});
describe('renderLogQLLineFilter not containing backticks', () => {
  test('base case - empty string', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        value: '',
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual('');
  });
  test('should not throw error when value undefined', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        //@ts-expect-error
        value: undefined,
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual('');
  });
  // REGEXP ops
  test('Renders positive case-insensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|~ "(?i).(search"');
  });
  test('Renders positive case-insensitive regex with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        value: '\nThe "key" field',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|~ "(?i)\\nThe \\"key\\" field"');
  });
  test('Renders positive case-sensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.regex,
        value: '\\w+',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|~ "\\\\w+"');
  });
  test('Renders negative case-sensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.negativeRegex,
        value: '\\w+',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('!~ "\\\\w+"');
  });
  test('Renders negative case-insensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.negativeRegex,
        value: '\\w+',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('!~ "(?i)\\\\w+"');
  });

  // String contains ops
  test('Renders positive case-insensitive string compare', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.match,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|~ "(?i)\\\\.\\\\(search"');
  });
  test('Renders positive case-sensitive string compare', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.match,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|= ".(search"');
  });
  test('Renders negative case-insensitive string compare', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.negativeMatch,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('!~ "(?i)\\\\.\\\\(search"');
  });
  test('Renders negative case-sensitive string compare', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.negativeMatch,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('!= ".(search"');
  });
});
describe('renderLogQLLineFilter containing backticks', () => {
  // Keep in mind we see twice as many escape chars in the test code as we do IRL
  test('Renders positive case-insensitive regex with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        // If a log line contains a newline as a string, they will need to escape the escape char and type "\\n" in the field input, otherwise loki will match actual newlines with regex searches
        value: '\\\\nThe `key` field', // the user enters: \\nThe `key` field
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual('|~ "(?i)\\\\\\\\nThe `key` field"');
  });
  test('Renders positive case-sensitive regex with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.regex,
        value: '\\\\nThe `key` field', // the user enters: \\nThe `key` field
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual('|~ "\\\\\\\\nThe `key` field"');
  });
  test('Renders positive case-insensitive match with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.match,
        value: '\\nThe `key` field', // the user enters: \nThe `key` field
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual(`|~ "(?i)\\\\\\\\nThe \`key\` field"`);
  });
  test('Renders positive case-sensitive match with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.match,
        value: '\\nThe `key` field', // the user enters: \nThe `key` field
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual('|= "\\\\nThe `key` field"');
  });
  test('Renders positive case-insensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        value: `^level=[error|warning].+((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}:\\d{5}"$|\``, // the user enters ^level=[error|warning].+((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}:\d{5}"$|`
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual(
      '|~ "(?i)^level=[error|warning].+((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}:\\\\d{5}\\"$|`"'
    );
  });
});
describe('wrapWildcardSearch', () => {
  it('should wrap string with case-insensitive query params', () => {
    expect(wrapWildcardSearch('.+')).toEqual('.+');
    expect(wrapWildcardSearch('Input-string')).toEqual('(?i).*Input-string.*');
    expect(wrapWildcardSearch('(?i).*Input-string.*')).toEqual('(?i).*Input-string.*');
  });
});
describe('unwrapWildcardSearch', () => {
  it('should unwrap case-insensitive params', () => {
    expect(unwrapWildcardSearch('(?i).*Input-string.*')).toEqual('Input-string');
    expect(unwrapWildcardSearch('Input-string')).toEqual('Input-string');
    expect(unwrapWildcardSearch('')).toEqual('');
    expect(unwrapWildcardSearch('.+')).toEqual('.+');
  });
});
