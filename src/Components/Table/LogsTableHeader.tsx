import React, { PropsWithChildren, useRef } from 'react';

import { css } from '@emotion/css';

import { Field, GrafanaTheme2 } from '@grafana/data';
import { ClickOutsideWrapper, IconButton, Popover, useTheme2 } from '@grafana/ui';

import { getBodyName } from '../../services/logsFrame';
import { useQueryContext } from './Context/QueryContext';
import { LogLineState, useTableColumnContext } from './Context/TableColumnsContext';
import { useTableHeaderContext } from 'Components/Table/Context/TableHeaderContext';

export interface LogsTableHeaderProps extends PropsWithChildren<CustomHeaderRendererProps> {
  fieldIndex: number;
}
//@todo delete when released in Grafana core
export interface CustomHeaderRendererProps {
  defaultContent: React.ReactNode;
  field: Field;
}

const getStyles = (theme: GrafanaTheme2, isFirstColumn: boolean, isLine: boolean) => ({
  clearButton: css({
    marginLeft: '5px',
  }),
  defaultContentWrapper: css({
    borderLeft: isFirstColumn ? `1px solid ${theme.colors.border.weak}` : 'none',
    display: 'flex',
    marginLeft: isFirstColumn ? '-6px' : 0,
    paddingLeft: isFirstColumn ? '12px' : 0,
  }),
  leftAlign: css({
    display: 'flex',
    label: 'left-align',
    width: 'calc(100% - 20px)',
  }),
  logLineButton: css({
    marginLeft: '5px',
  }),
  rightAlign: css({
    display: 'flex',
    label: 'right-align',
    marginRight: '5px',
  }),
  tableHeaderMenu: css({
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    height: '100%',
    label: 'tableHeaderMenu',
    margin: theme.spacing(1, 0),
    maxHeight: '400px',
    minWidth: '250px',
    padding: theme.spacing(2),
    width: '100%',
  }),
  wrapper: css({
    // Hack to show a visible resize indicator, despite 6px of padding on the header in grafana/table
    borderRight: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    label: 'wrapper',
    marginLeft: isFirstColumn ? '56px' : '6px',

    marginRight: '-6px',
    // Body has extra padding then other columns
    width: isLine ? 'calc(100% + 6px)' : '100%',
  }),
});

export const LogsTableHeader = (props: LogsTableHeaderProps) => {
  const { isHeaderMenuActive, setHeaderMenuActive } = useTableHeaderContext();
  const { logsFrame } = useQueryContext();
  const referenceElement = useRef<HTMLButtonElement | null>(null);
  const theme = useTheme2();
  const styles = getStyles(theme, props.fieldIndex === 0, props.field.name === getBodyName(logsFrame));
  const { bodyState, columnWidthMap, setBodyState, setColumnWidthMap } = useTableColumnContext();
  const isBodyField = props.field.name === getBodyName(logsFrame);

  const onLogTextToggle = () => {
    setBodyState(bodyState === LogLineState.text ? LogLineState.labels : LogLineState.text);
  };

  return (
    <span className={styles.wrapper}>
      <span className={styles.leftAlign}>
        <span className={styles.defaultContentWrapper}>{props.defaultContent}</span>
        {columnWidthMap && setColumnWidthMap && columnWidthMap?.[props.field.name] !== undefined && (
          <IconButton
            tooltip={'Reset column width'}
            tooltipPlacement={'top'}
            className={styles.clearButton}
            aria-label={'Reset column width'}
            name={'x'}
            onClick={() => {
              const { [props.field.name]: omit, ...map } = { ...columnWidthMap };
              setColumnWidthMap?.(map);
            }}
          />
        )}
        {isBodyField && (
          <>
            {bodyState === LogLineState.text ? (
              <IconButton
                tooltipPlacement={'top'}
                tooltip={'Show log labels'}
                aria-label={'Show log labels'}
                onClick={onLogTextToggle}
                className={styles.logLineButton}
                name={'brackets-curly'}
                size={'md'}
              />
            ) : (
              <IconButton
                tooltipPlacement={'top'}
                tooltip={'Show log text'}
                aria-label={'Show log text'}
                onClick={onLogTextToggle}
                className={styles.logLineButton}
                name={'text-fields'}
                size={'md'}
              />
            )}
          </>
        )}
      </span>
      <span className={styles.rightAlign}>
        <IconButton
          tooltip={`Show ${props.field.name} menu`}
          tooltipPlacement={'top'}
          ref={referenceElement}
          aria-label={`Show ${props.field.name} menu`}
          onClick={(e) => {
            setHeaderMenuActive(!isHeaderMenuActive);
          }}
          name={'ellipsis-v'}
        />
      </span>

      {referenceElement.current && (
        //@ts-ignore
        <Popover
          show={isHeaderMenuActive}
          content={
            <ClickOutsideWrapper onClick={() => setHeaderMenuActive(false)} useCapture={true}>
              <div className={styles.tableHeaderMenu}>{props.children}</div>
            </ClickOutsideWrapper>
          }
          referenceElement={referenceElement.current}
        />
      )}
    </span>
  );
};
