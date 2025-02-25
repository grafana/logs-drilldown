import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { LinkButton, useStyles2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { getDrillDownLink } from '../../services/navigate';
import { getLabelsVariable } from '../../services/variableGetters';
import { testIds } from '../../services/testIds';

import { isOperatorInclusive } from '../../services/operatorHelpers';
import { logger } from '../../services/logger';

export interface ShowLogsButtonSceneState extends SceneObjectState {
  disabled?: boolean;
  hidden?: boolean;
}
export class ShowLogsButtonScene extends SceneObjectBase<ShowLogsButtonSceneState> {
  constructor(state: Partial<ShowLogsButtonSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    const labelsVar = getLabelsVariable(this);
    const hasPositiveFilter = labelsVar.state.filters.some((f) => isOperatorInclusive(f.operator));
    this.setState({
      disabled: !hasPositiveFilter,
    });

    labelsVar.subscribeToState((newState) => {
      const hasPositiveFilter = newState.filters.some((f) => isOperatorInclusive(f.operator));
      this.setState({
        disabled: !hasPositiveFilter,
      });
    });
  }

  getLink = () => {
    const labelsVar = getLabelsVariable(this);
    const positiveFilter = labelsVar.state.filters.find((f) => isOperatorInclusive(f.operator));

    if (positiveFilter) {
      return getDrillDownLink(positiveFilter.key, positiveFilter.value);
    }

    logger.error('Cannot find filter to build link!');
    return '';
  };

  static Component = ({ model }: SceneComponentProps<ShowLogsButtonScene>) => {
    const { disabled, hidden } = model.useState();
    const styles = useStyles2(getStyles);

    if (hidden === true) {
      return null;
    }

    return (
      <LinkButton
        data-testid={testIds.index.header.showLogsButton}
        disabled={disabled}
        fill={'outline'}
        className={styles.button}
        href={model.getLink()}
      >
        Show logs
      </LinkButton>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      [theme.breakpoints.down('lg')]: {
        alignSelf: 'flex-end',
      },
      [theme.breakpoints.down('md')]: {
        marginTop: theme.spacing(1),
        alignSelf: 'flex-start',
      },

      alignSelf: 'flex-start',
      marginTop: '22px',
    }),
  };
}
