import { plugin } from '../module';
import { LogDefaults } from './logDefaults';
import { getBooleanLogOption, getLogOption, resetLogOptionsToDefaults, setLogOption } from './store';

const setAdminLogDefaults = (logDefaults?: LogDefaults) => {
  (plugin.meta as { jsonData?: object }).jsonData = { logDefaults };
};

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
    setAdminLogDefaults({
      wrapLogMessage: true,
      prettifyLogMessage: true,
      showTime: false,
      sortOrder: 'Ascending',
      fontSize: 'small',
    });
    expect(getBooleanLogOption('wrapLogMessage', false)).toBe(true);
    expect(getBooleanLogOption('prettifyLogMessage', false)).toBe(true);
    expect(getBooleanLogOption('showTime', true)).toBe(false);
    expect(getLogOption('sortOrder', 'Descending')).toBe('Ascending');
    expect(getLogOption('fontSize', 'default')).toBe('small');
  });

  it('does not tie prettify to the wrap default', () => {
    setAdminLogDefaults({ wrapLogMessage: true });
    expect(getBooleanLogOption('prettifyLogMessage', false)).toBe(false);
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

  it('applies the admin wrap default to the table view and reset clears its stored wrapping', () => {
    setAdminLogDefaults({ wrapLogMessage: true });
    expect(getBooleanLogOption('wrapText', false)).toBe(true);
    setLogOption('wrapText', false);
    expect(getBooleanLogOption('wrapText', true)).toBe(false);
    resetLogOptionsToDefaults();
    expect(getBooleanLogOption('wrapText', false)).toBe(true);
  });
});
