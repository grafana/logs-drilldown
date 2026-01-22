import React, { useEffect } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { IconButton, Pagination, Select, useStyles2 } from '@grafana/ui';

import { setServiceSelectionPageCount } from '../../services/store';
import { ServiceSelectionScene } from './ServiceSelectionScene';

export interface ServiceSelectionPaginationSceneState extends SceneObjectState {}

export class ServiceSelectionPaginationScene extends SceneObjectBase<ServiceSelectionPaginationSceneState> {
  public static PageCount = ({
    model,
    totalCount,
  }: SceneComponentProps<ServiceSelectionPaginationScene> & { totalCount: number }) => {
    const styles = useStyles2(getPageCountStyles);
    const serviceSelectionScene = sceneGraph.getAncestor(model, ServiceSelectionScene);
    const { countPerPage } = serviceSelectionScene.useState();
    const options = getCountOptionsFromTotal(totalCount);
    useEffect(() => {
      const lastOptionValue = options[options.length - 1]?.value ?? countPerPage.toString();
      if (countPerPage.toString() > lastOptionValue) {
        serviceSelectionScene.setState({ countPerPage: parseInt(lastOptionValue, 10) });
      }
    }, [countPerPage, options, serviceSelectionScene]);
    return (
      <span className={styles.searchPageCountWrap}>
        <span className={styles.searchFieldPlaceholderText}>
          Showing{' '}
          <Select
            className={styles.select}
            onChange={(value) => {
              if (value.value) {
                const countPerPage = parseInt(value.value, 10);
                serviceSelectionScene.setState({ countPerPage, currentPage: 1 });
                serviceSelectionScene.updateBody();
                setServiceSelectionPageCount(countPerPage);
              }
            }}
            options={options}
            value={countPerPage.toString()}
          />{' '}
          of {totalCount}{' '}
          <IconButton
            className={styles.icon}
            aria-label="Count info"
            name={'info-circle'}
            tooltip={`${totalCount} labels have values for the selected time range. Total label count may differ`}
          />
        </span>
      </span>
    );
  };
  public static Component = ({
    model,
    totalCount,
  }: SceneComponentProps<ServiceSelectionPaginationScene> & { totalCount: number }) => {
    const serviceSelectionScene = sceneGraph.getAncestor(model, ServiceSelectionScene);
    const { countPerPage, currentPage } = serviceSelectionScene.useState();
    const getStyles = (theme: GrafanaTheme2) => ({
      pagination: css({
        float: 'none',
      }),
      paginationWrap: css({
        [theme.breakpoints.up('lg')]: {
          display: 'none',
        },
        [theme.breakpoints.down('lg')]: {
          display: 'flex',
          flex: '1 0 auto',
          justifyContent: 'flex-end',
        },
      }),
      paginationWrapMd: css({
        [theme.breakpoints.down('lg')]: {
          display: 'none',
        },
        [theme.breakpoints.up('lg')]: {
          display: 'flex',
          flex: '1 0 auto',
          justifyContent: 'flex-end',
        },
      }),
    });

    const styles = useStyles2(getStyles);

    if (totalCount > countPerPage) {
      return (
        <>
          <span className={styles.paginationWrapMd}>
            <Pagination
              className={styles.pagination}
              currentPage={currentPage}
              numberOfPages={Math.ceil(totalCount / countPerPage)}
              onNavigate={(toPage) => {
                serviceSelectionScene.setState({ currentPage: toPage });
                serviceSelectionScene.updateBody();
              }}
            />
          </span>
          <span className={styles.paginationWrap}>
            <Pagination
              showSmallVersion={true}
              className={styles.pagination}
              currentPage={currentPage}
              numberOfPages={Math.ceil(totalCount / countPerPage)}
              onNavigate={(toPage) => {
                serviceSelectionScene.setState({ currentPage: toPage });
                serviceSelectionScene.updateBody();
              }}
            />
          </span>
        </>
      );
    }

    return null;
  };
}

function getPageCountStyles(theme: GrafanaTheme2) {
  return {
    icon: css({
      color: theme.colors.text.disabled,
      marginLeft: theme.spacing.x1,
    }),
    searchFieldPlaceholderText: css({
      alignItems: 'center',
      color: theme.colors.text.disabled,
      display: 'flex',
      flex: '1 0 auto',
      fontSize: theme.typography.bodySmall.fontSize,
      textWrapMode: 'nowrap',
    }),
    searchPageCountWrap: css({
      alignItems: 'center',
      display: 'flex',
    }),
    select: css({
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      maxWidth: '65px',
    }),
  };
}

export function getCountOptionsFromTotal(totalCount: number) {
  const delta = 20;
  const end = 60;
  const roundedTotalCount = Math.ceil(totalCount / delta) * delta;

  const options: Array<SelectableValue<string>> = [];
  for (let count = delta; count <= end && count <= roundedTotalCount; count += delta) {
    let label = count.toString();
    if (count < delta) {
      label = count.toString();
    } else if (count > totalCount) {
      label = totalCount.toString();
    }
    options.push({
      label,
      value: count.toString(),
    });
  }

  return options;
}
