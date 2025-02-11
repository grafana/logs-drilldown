import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { IconButton, Pagination, Select, useStyles2 } from '@grafana/ui';
import React from 'react';
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
    return (
      <span className={styles.searchPageCountWrap}>
        <span className={styles.searchFieldPlaceholderText}>
          Showing{' '}
          <Select
            className={styles.select}
            onChange={(value) => {
              if (value.value) {
                serviceSelectionScene.setState({ countPerPage: parseInt(value.value, 10) });
                serviceSelectionScene.updateBody();
              }
            }}
            options={[
              { value: '20', label: '20' },
              { value: '40', label: '40' },
              {
                value: '60',
                label: '60',
              },
            ]}
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
          justifyContent: 'flex-end',
          flex: '1 0 auto',
        },
      }),
      paginationWrapMd: css({
        [theme.breakpoints.down('lg')]: {
          display: 'none',
        },
        [theme.breakpoints.up('lg')]: {
          display: 'flex',
          justifyContent: 'flex-end',
          flex: '1 0 auto',
        },
      }),
    });

    const styles = useStyles2(getStyles);

    return (
      <>
        <span className={styles.paginationWrapMd}>
          <Pagination
            className={styles.pagination}
            currentPage={currentPage}
            numberOfPages={Math.floor(totalCount / countPerPage)}
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
            numberOfPages={Math.floor(totalCount / countPerPage)}
            onNavigate={(toPage) => {
              serviceSelectionScene.setState({ currentPage: toPage });
              serviceSelectionScene.updateBody();
            }}
          />
        </span>
      </>
    );
  };
}

function getPageCountStyles(theme: GrafanaTheme2) {
  return {
    icon: css({
      color: theme.colors.text.disabled,
      marginLeft: theme.spacing.x1,
    }),
    searchPageCountWrap: css({
      display: 'flex',
      alignItems: 'center',
    }),
    select: css({
      maxWidth: '65px',
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
    }),
    searchFieldPlaceholderText: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.disabled,
      alignItems: 'center',
      display: 'flex',
      flex: '1 0 auto',
      textWrapMode: 'nowrap',
    }),
  };
}
