import { css } from '@emotion/css';

import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';

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
    defaultWithMS: true,
    timeZone: timeZone,
  });
};

export const getJSONVizValueLabelStyles = (theme: GrafanaTheme2) => ({
  labelButtonsWrap: css({
    color: 'var(--json-tree-label-color)',
    display: 'inline-flex',
    marginLeft: '4px',
  }),
});
export const jsonLabelWrapStyles = css({
  alignItems: 'center',
  color: 'var(--json-tree-label-color)',
  display: 'inline-flex',
  marginLeft: '4px',
});
export const jsonLabelWrapStylesPrimary = css({
  alignItems: 'center',
  display: 'inline-flex',
});
export const drillUpWrapperStyle = css({
  alignItems: 'center',
  display: 'flex',
});
export const drillUpContainerStyle = css({
  display: 'flex',
  alignItems: 'center',
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
  // Match small button font size
  fontSize: '12px',
  textWrap: 'nowrap',
});
export const itemStringStyles = css({
  color: 'var(--json-tree-label-color)',
});
export const labelButtonStyles = css({
  color: 'var(--json-tree-label-color)',
});
