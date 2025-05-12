import { GrafanaTheme2 } from '@grafana/data';

// from /grafana/grafana/packages/grafana-ui/src/themes/mixins.ts
export function getFocusStyles(theme: GrafanaTheme2) {
  return {
    boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
    outline: '2px dotted transparent',
    outlineOffset: '2px',
    transitionDuration: '0.2s',
    transitionProperty: 'outline, outline-offset, box-shadow',
    transitionTimingFunction: `cubic-bezier(0.19, 1, 0.22, 1)`,
  };
}

export function getMouseFocusStyles(theme: GrafanaTheme2) {
  return {
    boxShadow: `none`,
    outline: 'none',
  };
}

export function getIconButtonBefore(hoverSize: number, theme: GrafanaTheme2) {
  return {
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transitionDuration: '0.2s',
      transitionProperty: 'opacity',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    borderRadius: theme.shape.radius.default,
    content: '""',
    height: `${hoverSize}px`,
    opacity: '0',
    position: 'absolute',
    width: `${hoverSize}px`,
    zIndex: '-1',
  };
}
