import { AdHocFilterWithLabels } from '@grafana/scenes';

import {
  applyLogSelectionToLineFilters,
  lineFilterRowIsEmpty,
  nextLineFilterKeyLabel,
} from './LineFilterVariablesScene';
import { LineFilterCaseSensitive, LineFilterOp } from 'services/filterTypes';

describe('lineFilterRowIsEmpty', () => {
  it('treats undefined, empty, and whitespace-only as empty', () => {
    expect(
      lineFilterRowIsEmpty({
        key: '',
        operator: LineFilterOp.match,
        value: undefined,
      } as unknown as AdHocFilterWithLabels)
    ).toBe(true);
    expect(lineFilterRowIsEmpty({ key: '', operator: LineFilterOp.match, value: '' } as AdHocFilterWithLabels)).toBe(
      true
    );
    expect(
      lineFilterRowIsEmpty({ key: '', operator: LineFilterOp.match, value: '  \t' } as AdHocFilterWithLabels)
    ).toBe(true);
  });

  it('treats non-whitespace value as non-empty', () => {
    expect(lineFilterRowIsEmpty({ key: '', operator: LineFilterOp.match, value: 'x' } as AdHocFilterWithLabels)).toBe(
      false
    );
  });
});

describe('applyLogSelectionToLineFilters', () => {
  it('fills the first empty row without adding a filter', () => {
    const filters: AdHocFilterWithLabels[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        keyLabel: '0',
        operator: LineFilterOp.regex,
        value: '',
      },
    ];
    const next = applyLogSelectionToLineFilters(filters, 'caller=instance.go', LineFilterOp.match);
    expect(next).toHaveLength(1);
    expect(next[0].value).toBe('caller=instance.go');
    expect(next[0].operator).toBe(LineFilterOp.match);
    expect(next[0].key).toBe(LineFilterCaseSensitive.caseInsensitive);
    expect(next[0].keyLabel).toBe('0');
  });

  it('uses first empty row when multiple rows exist', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: LineFilterCaseSensitive.caseSensitive, keyLabel: '0', operator: LineFilterOp.match, value: 'a' },
      { key: LineFilterCaseSensitive.caseSensitive, keyLabel: '1', operator: LineFilterOp.match, value: '' },
    ];
    const next = applyLogSelectionToLineFilters(filters, 'b', LineFilterOp.negativeMatch);
    expect(next).toHaveLength(2);
    expect(next[0].value).toBe('a');
    expect(next[1].value).toBe('b');
    expect(next[1].operator).toBe(LineFilterOp.negativeMatch);
  });

  it('appends with nextLineFilterKeyLabel when no empty row', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: LineFilterCaseSensitive.caseSensitive, keyLabel: '0', operator: LineFilterOp.match, value: 'a' },
      { key: LineFilterCaseSensitive.caseSensitive, keyLabel: '2', operator: LineFilterOp.match, value: 'b' },
    ];
    const next = applyLogSelectionToLineFilters(filters, 'c', LineFilterOp.match);
    expect(next).toHaveLength(3);
    expect(next[2].value).toBe('c');
    expect(next[2].operator).toBe(LineFilterOp.match);
    expect(next[2].key).toBe(LineFilterCaseSensitive.caseSensitive);
    expect(next[2].keyLabel).toBe(nextLineFilterKeyLabel(filters));
    expect(next[2].keyLabel).toBe('3');
  });

  it('appends to empty filters array', () => {
    const next = applyLogSelectionToLineFilters([], 'x', LineFilterOp.match);
    expect(next).toHaveLength(1);
    expect(next[0].value).toBe('x');
    expect(next[0].key).toBe(LineFilterCaseSensitive.caseSensitive);
    expect(next[0].keyLabel).toBe('0');
  });
});
