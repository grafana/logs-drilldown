import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export function getJSONVizNestedProperty(obj: Record<string, any>, props: Array<string | number>): any {
  if (props.length === 1) {
    return obj[props[0]];
  }
  const prop = props.shift();
  if (prop !== undefined) {
    return getJSONVizNestedProperty(obj[prop], props);
  }
}

export const renderJSONVizTimeStamp = (epochMs: number, timeZone?: string) => {
  return dateTimeFormat(epochMs, {
    timeZone: timeZone,
    defaultWithMS: true,
  });
};

export const getJSONVizValueLabelStyles = (theme: GrafanaTheme2) => ({
  labelButtonsWrap: css({
    display: 'inline-flex',
    color: 'var(--json-tree-label-color)',
  }),
  labelWrap: jsonLabelWrapStyles,
});

export const jsonLabelWrapStyles = css({
  color: 'var(--json-tree-label-color)',
  display: 'inline-flex',
  alignItems: 'center',
});

export const drillUpWrapperStyle = css({
  display: 'flex',
  alignItems: 'center',
  overflowX: 'auto',
});
export const breadCrumbDelimiter = css({
  marginLeft: '0.5em',
  marginRight: '0.5em',
});
export const itemStringDelimiter = css({
  marginLeft: '0.5em',
});
export const rootNodeItemString = css({
  display: 'flex',
  flexWrap: 'nowrap',
  textWrap: 'nowrap',
  // Match small button font size
  fontSize: '12px',
});
