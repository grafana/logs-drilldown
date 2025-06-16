import React from 'react';

import { DataQueryError, LoadingState } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataProvider,
  SceneDataState,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneReactObject,
} from '@grafana/scenes';
import { DrawStyle, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { areArraysEqual } from '../../../services/comparison';
import {
  buildFieldsQueryString,
  getFilterBreakdownValueScene,
  getParserForField,
  getParserFromFieldsFilters,
} from '../../../services/fields';
import { logger } from '../../../services/logger';
import { LokiQuery } from '../../../services/lokiQuery';
import { getQueryRunner } from '../../../services/panel';
import { buildDataQuery, renderLogQLFieldFilters, renderLogQLMetadataFilters } from '../../../services/query';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { getSortByPreference } from '../../../services/store';
import {
  getFieldGroupByVariable,
  getFieldsVariable,
  getJsonFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
  getMetadataVariable,
  getPatternsVariable,
} from '../../../services/variableGetters';
import { ParserType, VAR_FIELDS, VAR_METADATA } from '../../../services/variables';
import { getPanelWrapperStyles, PanelMenu } from '../../Panels/PanelMenu';
import { getDetectedFieldsFrame } from '../ServiceScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS, FieldsBreakdownScene } from './FieldsBreakdownScene';
import { LayoutSwitcher } from './LayoutSwitcher';
import { ValueSummaryPanelScene } from './Panels/ValueSummary';
import { QueryErrorAlert } from './QueryErrorAlert';
import { getLabelValue } from './SortByScene';

export interface FieldValuesBreakdownSceneState extends SceneObjectState {
  $data?: SceneDataProvider;
  body?: (LayoutSwitcher & SceneObject) | (SceneReactObject & SceneObject);
  errorBody?: SceneFlexLayout;
}

export class FieldValuesBreakdownScene extends SceneObjectBase<FieldValuesBreakdownSceneState> {
  constructor(state: Partial<FieldValuesBreakdownSceneState>) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Selector({ model }: SceneComponentProps<FieldValuesBreakdownScene>) {
    const { body } = model.useState();
    if (body instanceof LayoutSwitcher) {
      return <>{body && <LayoutSwitcher.Selector model={body} />}</>;
    }

    return <></>;
  }

  public static Component = ({ model }: SceneComponentProps<FieldValuesBreakdownScene>) => {
    const { body, errorBody } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);

    if (body) {
      return (
        <span className={styles.panelWrapper}>
          {errorBody && (
            <div className={styles.errorWrapper}>
              <errorBody.Component model={errorBody} />
            </div>
          )}
          <div>
            {body instanceof LayoutSwitcher && <body.Component model={body} />}
            {!(body instanceof LayoutSwitcher) && body && <body.Component model={body} />}
          </div>
        </span>
      );
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };

  private getTagKey() {
    const groupByVariable = getFieldGroupByVariable(this);
    return String(groupByVariable.state.value);
  }

  onActivate() {
    const query = this.buildQuery();

    // Set query runner
    this.setState({
      $data: this.buildQueryRunner(),
      body: this.build(query),
      errorBody: undefined,
    });

    // Subscribe to data query changes
    this._subs.add(
      this.state.$data?.subscribeToState((newState) => {
        this.onValuesDataQueryChange(newState, query);
      })
    );

    this.runQuery();
    this.setSubscriptions();
  }

  private buildQueryRunner() {
    const query = this.buildQuery();
    return getQueryRunner([query], { runQueriesMode: 'manual' });
  }

  /**
   * Builds the LokiQuery for the value breakdown
   */
  private buildQuery() {
    const tagKey = this.getTagKey();
    const fieldsVariable = getFieldsVariable(this);
    const detectedFieldsFrame = getDetectedFieldsFrame(this);
    const jsonVariable = getJsonFieldsVariable(this);
    const queryString = buildFieldsQueryString(tagKey, fieldsVariable, detectedFieldsFrame, jsonVariable);
    // Manually interpolate query so we don't pollute the variable interpolation for other queries
    const { filterExpression, variableName } = this.removeFieldLabelFromVariableInterpolation();
    const expression = sceneGraph.interpolate(this, queryString.replace(`$\{${variableName}}`, filterExpression));

    return buildDataQuery(expression, { legendFormat: `{{${tagKey}}}`, refId: tagKey });
  }

  /**
   * Sets activation subscriptions
   */
  private setSubscriptions() {
    // Subscribe to time range changes
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        // Run query on time range change
        this.runQuery();
      })
    );

    // VARIABLE SUBS
    // Subscribe to line filter changes
    this._subs.add(
      getLineFiltersVariable(this).subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );

    // Subscribe to pattern filter changes
    this._subs.add(
      getPatternsVariable(this).subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.runQuery();
        }
      })
    );

    // Subscribe to labels variable changes
    this._subs.add(
      getLabelsVariable(this).subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );

    // Subscribe to levels variable changes
    this._subs.add(
      getLevelsVariable(this).subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );

    const { parser } = this.getParserForThisField();

    if (parser !== 'structuredMetadata') {
      this.setFieldParserSubscriptions();
    } else {
      this.setMetadataParserSubscriptions();
    }
  }

  /**
   * Subscribe to variables for metadata breakdowns
   */
  private setMetadataParserSubscriptions() {
    const key = this.getTagKey();
    // Subscribe to any fields change and run the query without change
    this._subs.add(
      getFieldsVariable(this).subscribeToState(async (newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );

    this._subs.add(
      getMetadataVariable(this).subscribeToState(async (newState, prevState) => {
        if (
          !areArraysEqual(
            newState.filters.filter((f) => f.key !== key),
            prevState.filters.filter((f) => f.key !== key)
          )
        ) {
          this.runQuery();
        }
      })
    );
  }

  /**
   * Subscribe to variables for field breakdowns
   */
  private setFieldParserSubscriptions() {
    const key = this.getTagKey();
    // Subscribe to any metadata change and run the query without alteration
    this._subs.add(
      getMetadataVariable(this).subscribeToState(async (newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );
    // Subscribe to fields variable, run the query if the change wasn't for this label
    this._subs.add(
      getFieldsVariable(this).subscribeToState(async (newState, prevState) => {
        if (
          !areArraysEqual(
            newState.filters.filter((f) => f.key !== key),
            prevState.filters.filter((f) => f.key !== key)
          )
        ) {
          this.runQuery();
        }
      })
    );
  }

  /**
   * Rebuild the query before running.
   * If so update the query with the new parser and set the parser to state.
   */
  private rebuildQuery() {
    const query = this.buildQuery();
    this.getSceneQueryRunner()?.setState({
      queries: [query],
    });
  }

  /**
   * Run the field values breakdown query.
   * Generates the filterExpression excluding all filters with a key that matches the label.
   */
  private runQuery() {
    // Update the filters to exclude the current value so all options are displayed to the user
    this.rebuildQuery();
    const queryRunner = this.getSceneQueryRunner();
    queryRunner?.runQueries();
  }

  /**
   * Returns the query runner
   */
  private getSceneQueryRunner() {
    if (this.state.$data) {
      const queryRunners = sceneGraph.findDescendents(this.state.$data, SceneQueryRunner);
      if (queryRunners.length !== 1) {
        const error = new Error('Unable to find query runner in value breakdown!');
        logger.error(error, { msg: 'FieldValuesBreakdownScene: Unable to find query runner in value breakdown!' });
        throw error;
      }

      return queryRunners[0];
    }
    logger.warn('FieldValuesBreakdownScene: Query is attempting to execute, but query runner is undefined!');
    return undefined;
  }

  /**
   * Sets the expression builder to exclude the current field label
   */
  private removeFieldLabelFromVariableInterpolation() {
    const tagKey = this.getTagKey();
    let filterExpression;
    let variableName: typeof VAR_FIELDS | typeof VAR_METADATA;

    // We want the parser for this field, we only need to exclude keys for the variable type that matches this value breakdown
    const parser = this.getQueryParser();
    if (parser === 'structuredMetadata') {
      const metadataVar = getMetadataVariable(this);
      variableName = VAR_METADATA;
      filterExpression = renderLogQLMetadataFilters(metadataVar.state.filters, [tagKey]);
    } else {
      variableName = VAR_FIELDS;
      const fieldsVar = getFieldsVariable(this);
      filterExpression = renderLogQLFieldFilters(fieldsVar.state.filters, [tagKey]);
    }

    return { filterExpression, variableName };
  }

  /**
   * Actions to run when the value breakdown query response is received.
   */
  private onValuesDataQueryChange(newState: SceneDataState, query: LokiQuery) {
    if (newState.data?.state === LoadingState.Done) {
      if (this.state.body instanceof SceneReactObject) {
        this.setState({
          body: this.build(query),
          errorBody: undefined,
        });
      }
    }
    if (newState.data?.state === LoadingState.Error) {
      this.setErrorState(newState.data.errors, newState.data.series.length > 0);
    }
  }

  /**
   * Sets the error body state
   */
  private setErrorState(errors: DataQueryError[] | undefined, isPartial: boolean) {
    this.setState({
      errorBody: new SceneFlexLayout({
        children: [
          new SceneFlexItem({
            body: new SceneReactObject({
              reactNode: <QueryErrorAlert errors={errors} tagKey={this.getTagKey()} isPartial={isPartial} />,
            }),
          }),
        ],
        direction: 'column',
      }),
    });
  }

  /**
   * Builds the layout switcher
   */
  private build(query: LokiQuery) {
    const { optionValue, parser } = this.getParserForThisField();
    const { direction, sortBy } = getSortByPreference('fields', DEFAULT_SORT_BY, 'desc');
    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    const getFilter = () => fieldsBreakdownScene.state.search.state.filter ?? '';

    return new LayoutSwitcher({
      active: 'grid',
      layouts: [
        // Single
        new SceneFlexLayout({
          children: [
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.LabelsMenu model={fieldsBreakdownScene} />,
            }),
            new SceneFlexItem({
              body: PanelBuilders.timeseries()
                .setTitle(optionValue)
                .setShowMenuAlways(true)
                .setMenu(new PanelMenu({}))
                .build(),
              minHeight: 300,
            }),
          ],
          direction: 'column',
        }),

        // Grid
        new SceneFlexLayout({
          children: [
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.LabelsMenu model={fieldsBreakdownScene} />,
            }),
            new ValueSummaryPanelScene({ tagKey: this.getTagKey(), title: optionValue, type: 'field' }),
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.ValuesMenu model={fieldsBreakdownScene} />,
            }),
            new ByFrameRepeater({
              body: new SceneCSSGridLayout({
                autoRows: '200px',
                children: [
                  new SceneFlexItem({
                    body: new SceneReactObject({
                      reactNode: <LoadingPlaceholder text="Loading..." />,
                    }),
                  }),
                ],
                isLazy: true,
                templateColumns: FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
              }),
              direction,
              getFilter,
              getLayoutChild: getFilterBreakdownValueScene(
                getLabelValue,
                query?.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
                parser === 'structuredMetadata' ? VAR_METADATA : VAR_FIELDS,
                sceneGraph.getAncestor(this, FieldsBreakdownScene).state.sort,
                optionValue
              ),
              sortBy,
            }),
          ],
          direction: 'column',
        }),

        // Rows
        new SceneFlexLayout({
          children: [
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.LabelsMenu model={fieldsBreakdownScene} />,
            }),
            new ValueSummaryPanelScene({ tagKey: this.getTagKey(), title: optionValue, type: 'field' }),
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.ValuesMenu model={fieldsBreakdownScene} />,
            }),
            new ByFrameRepeater({
              body: new SceneCSSGridLayout({
                autoRows: '200px',
                children: [
                  new SceneFlexItem({
                    body: new SceneReactObject({
                      reactNode: <LoadingPlaceholder text="Loading..." />,
                    }),
                  }),
                ],
                isLazy: true,
                templateColumns: '1fr',
              }),
              direction,
              getFilter,
              getLayoutChild: getFilterBreakdownValueScene(
                getLabelValue,
                query?.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
                parser === 'structuredMetadata' ? VAR_METADATA : VAR_FIELDS,
                sceneGraph.getAncestor(this, FieldsBreakdownScene).state.sort,
                optionValue
              ),
              sortBy,
            }),
          ],
          direction: 'column',
        }),
      ],
      options: [
        { label: 'Single', value: 'single' },
        { label: 'Grid', value: 'grid' },
        { label: 'Rows', value: 'rows' },
      ],
    });
  }

  /**
   * Gets the parser for the value breakdown
   */
  private getParserForThisField() {
    const groupByVariable = getFieldGroupByVariable(this);
    const optionValue = String(groupByVariable.state.value);
    const parserForThisField = getParserForField(optionValue, this);
    return { optionValue, parser: parserForThisField };
  }

  /**
   * Gets the parser needed for fields variables
   */
  private getParserForFields() {
    return getParserFromFieldsFilters(getFieldsVariable(this));
  }

  /**
   * Gets the parser needed to run a query for the field variable and the breakdown field
   */
  private getQueryParser(): ParserType {
    const { parser } = this.getParserForThisField();
    const parserForFields = this.getParserForFields();

    // If the parser needed to parse this field matches the parser needed to parse the fields
    if (parser === parserForFields) {
      return parserForFields;
    }
    // If there is no parser in the detected_fields frame for this field, let's play it safe and return mixed
    if (parser === undefined) {
      return 'mixed';
    }
    // If the parser for the breakdown field is metadata, return the parser for fields
    if (parser === 'structuredMetadata') {
      return parserForFields;
    }
    // if the parser for fields is metadata, return parser for the breakdown field
    if (parserForFields === 'structuredMetadata') {
      return parser;
    }
    return 'mixed';
  }
}
