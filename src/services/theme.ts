import { GrafanaTheme2 } from '@grafana/data';

export const isVisualDesignRefreshEnabled = (theme: GrafanaTheme2) =>
  Boolean((theme.flags as { visualDesignRefresh?: boolean } | undefined)?.visualDesignRefresh);
