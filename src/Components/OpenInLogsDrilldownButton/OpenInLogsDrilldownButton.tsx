import React, { useMemo } from 'react';

import { AbstractLabelOperator } from '@grafana/data';
import { useReturnToPrevious } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { OpenInLogsDrilldownButtonProps } from './types';
import {
  appendUrlParameter,
  createAppUrl,
  escapeURLDelimiters,
  replaceEscapeChars,
  replaceSlash,
  setUrlParameter,
  stringifyAdHocValues,
  UrlParameters,
} from 'services/extensions/links';
import { LabelFilterOp } from 'services/filterTypes';

const operatorMap = {
  [AbstractLabelOperator.Equal]: LabelFilterOp.Equal,
  [AbstractLabelOperator.NotEqual]: LabelFilterOp.NotEqual,
  [AbstractLabelOperator.EqualRegEx]: LabelFilterOp.RegexEqual,
  [AbstractLabelOperator.NotEqualRegEx]: LabelFilterOp.RegexNotEqual,
};

export default function OpenInLogsDrilldownButton({
  datasourceUid,
  from,
  renderButton,
  returnToPreviousSource,
  streamSelectors,
  to,
}: OpenInLogsDrilldownButtonProps) {
  const setReturnToPrevious = useReturnToPrevious();

  const href = useMemo(() => {
    const mainLabel = streamSelectors[0];

    if (
      !mainLabel ||
      // we can't open in explore logs if main label matcher is something different from equal
      mainLabel?.operator !== AbstractLabelOperator.Equal
    ) {
      return null;
    }

    const labelValue = replaceSlash(mainLabel.value);

    let params = new URLSearchParams();

    if (datasourceUid) {
      params = setUrlParameter(UrlParameters.DatasourceId, datasourceUid, params);
    }

    if (from) {
      params = setUrlParameter(UrlParameters.TimeRangeFrom, from, params);
    }

    if (to) {
      params = setUrlParameter(UrlParameters.TimeRangeTo, to, params);
    }

    streamSelectors.forEach((streamSelector) => {
      params = appendUrlParameter(
        UrlParameters.Labels,
        `${streamSelector.name}|${operatorMap[streamSelector.operator]}|${escapeURLDelimiters(
          stringifyAdHocValues(streamSelector.value)
        )},${escapeURLDelimiters(replaceEscapeChars(streamSelector.value))}`,
        params
      );
    });

    return createAppUrl(`/explore/${mainLabel.name}/${labelValue}/logs`, params);
  }, [datasourceUid, from, to, streamSelectors]);

  if (!href) {
    return null;
  }

  if (renderButton) {
    return renderButton({ href });
  }

  return (
    <LinkButton
      variant="secondary"
      href={href}
      onClick={() => {
        reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.link_button_click);
        setReturnToPrevious(returnToPreviousSource || 'previous');
      }}
    >
      Open in Logs Drilldown
    </LinkButton>
  );
}
