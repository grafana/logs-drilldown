import React from 'react';

import {
  getLineFilterMatches,
  highlightValueStringMatches,
  mergeOverlapping,
  mergeStringsAndElements,
} from './highlight';

describe('mergeOverlapping', () => {
  it('base case', () => {
    expect(mergeOverlapping([])).toEqual(0);
  });
  it('ignores non-overlapping', () => {
    const input = [
      [0, 4],
      [5, 100],
    ];
    const size = mergeOverlapping(input);
    expect(size).toBe(2);
    expect(input[0]).toEqual([0, 4]);
    expect(input[1]).toEqual([5, 100]);
  });
  it('ignores overlapping intervals that contain other intervals', () => {
    const input = [
      [0, 4],
      [2, 3],
      [1, 3],
      [2, 4],
    ];
    const size = mergeOverlapping(input);
    expect(size).toBe(1);
    expect(input[0]).toEqual([0, 4]);
  });
  it('merges overlapping intervals', () => {
    const input = [
      [0, 4],
      [2, 7],
      [9, 12],
    ];
    const size = mergeOverlapping(input);
    expect(size).toBe(2);
    expect(input[0]).toEqual([0, 7]);
    expect(input[1]).toEqual([9, 12]);
  });
});
describe('getLineFilterMatches', () => {
  it('base case', () => {
    expect(getLineFilterMatches([], 'abc123')).toEqual([]);
  });
  it('returns indices for each regex matching string', () => {
    const result = getLineFilterMatches([/a/g, /b/g, /.+/g], 'abc');
    expect(result).toEqual([
      [0, 1],
      [1, 2],
      [0, 3],
    ]);
  });

  it('returns indices for each regex matching string', () => {
    const result = getLineFilterMatches([/abc/g, /123/g, /bc12/g], 'abc123');
    expect(result).toEqual([
      [0, 3],
      [3, 6],
      [1, 5],
    ]);
  });
});
describe('highlightValueStringMatches', () => {
  it('base case', () => {
    const result = highlightValueStringMatches([], '', 0);
    expect(result).toEqual([]);
  });

  it('wraps text matching interval at start', () => {
    const result = highlightValueStringMatches([[0, 4]], 'abcdefghijklmnopqrst', 1);
    expect(result).toEqual([<mark>abcd</mark>, 'efghijklmnopqrst']);
  });

  it('wraps text matching interval in middle', () => {
    const result = highlightValueStringMatches([[4, 8]], 'abcdefghijklmnopqrst', 1);
    expect(result).toEqual(['abcd', <mark>efgh</mark>, 'ijklmnopqrst']);
  });

  it('wraps text matching interval at end', () => {
    const result = highlightValueStringMatches([[16, 20]], 'abcdefghijklmnopqrst', 1);
    expect(result).toEqual(['abcdefghijklmnop', <mark>qrst</mark>]);
  });

  it('wraps text matching intervals', () => {
    const result = highlightValueStringMatches(
      [
        [0, 4],
        [6, 8],
      ],
      'abcdefghijklmnopqrst',
      2
    );
    expect(result).toEqual([<mark>abcd</mark>, 'ef', <mark>gh</mark>, 'ijklmnopqrst']);
  });
});

describe('mergeStringsAndElements', () => {
  it('base case', () => {
    expect(mergeStringsAndElements([])).toEqual([]);
  });
  it('should merge contiguous strings and jsx elements', () => {
    const input = [...'abcde'.split(''), ...'fghi'.split('').map((c) => ({ value: c })), ...'ijklmnopqrst'.split('')];
    expect(mergeStringsAndElements(input)).toEqual(['abcde', <mark>fghi</mark>, 'ijklmnopqrst']);
  });
});
