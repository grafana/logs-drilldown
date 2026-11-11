import { setAdminLogDefaults } from './logDefaults';
import { getBooleanLogOption, getLogOption, resetLogOptionsToDefaults, setLogOption } from './store';

describe('log defaults lookup order', () => {
  beforeEach(() => {
    localStorage.clear();
    setAdminLogDefaults(undefined);
  });

  it('falls back to the built-in default', () => {
    expect(getBooleanLogOption('wrapLogMessage', false)).toBe(false);
    expect(getLogOption('sortOrder', 'Descending')).toBe('Descending');
  });

  it('uses admin defaults over built-in defaults', () => {
    setAdminLogDefaults({ wrapLogMessage: true, showTime: false, sortOrder: 'Ascending', fontSize: 'small' });
    expect(getBooleanLogOption('wrapLogMessage', false)).toBe(true);
    expect(getBooleanLogOption('prettifyLogMessage', false)).toBe(true);
    expect(getBooleanLogOption('showTime', true)).toBe(false);
    expect(getLogOption('sortOrder', 'Descending')).toBe('Ascending');
    expect(getLogOption('fontSize', 'default')).toBe('small');
  });

  it('prefers localStorage over admin defaults', () => {
    setAdminLogDefaults({ wrapLogMessage: true, sortOrder: 'Ascending' });
    setLogOption('wrapLogMessage', false);
    setLogOption('sortOrder', 'Descending');
    expect(getBooleanLogOption('wrapLogMessage', true)).toBe(false);
    expect(getLogOption('sortOrder', 'Ascending')).toBe('Descending');
  });

  it('reset clears user options so admin defaults apply again', () => {
    setAdminLogDefaults({ wrapLogMessage: true });
    setLogOption('wrapLogMessage', false);
    resetLogOptionsToDefaults();
    expect(getBooleanLogOption('wrapLogMessage', false)).toBe(true);
  });
});
