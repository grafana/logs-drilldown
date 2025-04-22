import saveAs from 'file-saver';
import {
  CSVConfig,
  CustomTransformOperator,
  DataFrame,
  DataTransformerConfig,
  DataTransformerID,
  dateTime,
  dateTimeFormat,
  Field,
  FieldType,
  getTimeField,
  LogRowModel,
  LogsMetaItem,
  LogsModel,
  toCSV,
  transformDataFrame,
} from '@grafana/data';
import { lastValueFrom, map, Observable } from 'rxjs';
import { getDataframeFields, getLogsExtractFields } from './logsFrame';

export enum DownloadFormat {
  Text = 'text',
  Json = 'json',
  CSV = 'csv',
}

export const download = async (format: DownloadFormat, logRows: LogRowModel[], meta?: LogsMetaItem[]) => {
  switch (format) {
    case DownloadFormat.Text:
      downloadLogsModelAsTxt({ meta, rows: logRows });
      break;
    case DownloadFormat.Json:
      const jsonLogs = logRowsToReadableJson(logRows);
      const blob = new Blob([JSON.stringify(jsonLogs)], {
        type: 'application/json;charset=utf-8',
      });
      const fileName = `Logs-${dateTimeFormat(new Date())}.json`;
      saveAs(blob, fileName);
      break;
    case DownloadFormat.CSV:
      const dataFrameMap = new Map<string, DataFrame>();
      logRows.forEach((row) => {
        if (row.dataFrame?.refId && !dataFrameMap.has(row.dataFrame?.refId)) {
          dataFrameMap.set(row.dataFrame?.refId, row.dataFrame);
        }
      });
      dataFrameMap.forEach(async (dataFrame) => {
        const transforms: Array<DataTransformerConfig | CustomTransformOperator> = getLogsExtractFields(dataFrame);
        transforms.push(
          {
            id: 'organize',
            options: {
              excludeByName: {
                ['labels']: true,
                ['labelTypes']: true,
              },
            },
          },
          addISODateTransformation
        );
        const transformedDataFrame = await lastValueFrom(transformDataFrame(transforms, [dataFrame]));
        downloadDataFrameAsCsv(transformedDataFrame[0], `Logs-${dataFrame.refId}`);
      });
  }
};

const addISODateTransformation: CustomTransformOperator = () => (source: Observable<DataFrame[]>) => {
  return source.pipe(
    map((data: DataFrame[]) => {
      return data.map((frame: DataFrame) => {
        const timeField = getTimeField(frame);
        const field: Field = {
          name: 'Date',
          values: timeField.timeField ? timeField.timeField?.values.map((v) => dateTime(v).toISOString()) : [],
          type: FieldType.other,
          config: {},
        };
        return {
          ...frame,
          fields: [field, ...frame.fields],
        };
      });
    })
  );
};

export function logRowsToReadableJson(logs: LogRowModel[]) {
  return logs.map((log) => {
    const fields = getDataframeFields(log).reduce<Record<string, string>>((acc, field) => {
      const key = field.keys[0];
      acc[key] = field.values[0];
      return acc;
    }, {});

    return {
      line: log.entry,
      timestamp: log.timeEpochNs,
      date: dateTime(log.timeEpochMs).toISOString(),
      fields: {
        ...fields,
        ...log.labels,
      },
    };
  });
}

/**
 * Downloads a DataFrame as a TXT file.
 *
 * @param {(Pick<LogsModel, 'meta' | 'rows'>)} logsModel
 * @param {string} title
 */
export function downloadLogsModelAsTxt(logsModel: Pick<LogsModel, 'meta' | 'rows'>, title = '') {
  let textToDownload = '';

  logsModel.meta?.forEach((metaItem) => {
    const string = `${metaItem.label}: ${JSON.stringify(metaItem.value)}\n`;
    textToDownload = textToDownload + string;
  });
  textToDownload = textToDownload + '\n\n';

  logsModel.rows.forEach((row) => {
    const newRow = row.timeEpochMs + '\t' + dateTime(row.timeEpochMs).toISOString() + '\t' + row.entry + '\n';
    textToDownload = textToDownload + newRow;
  });

  const blob = new Blob([textToDownload], {
    type: 'text/plain;charset=utf-8',
  });
  const fileName = `${title ? `${title}-logs` : 'Logs'}-${dateTimeFormat(new Date())}.txt`;
  saveAs(blob, fileName);
}

/**
 * Exports a DataFrame as a CSV file.
 *
 * @param {DataFrame} dataFrame
 * @param {string} title
 * @param {CSVConfig} [csvConfig]
 * @param {DataTransformerID} [transformId=DataTransformerID.noop]
 */
export function downloadDataFrameAsCsv(
  dataFrame: DataFrame,
  title: string,
  csvConfig?: CSVConfig,
  transformId: DataTransformerID = DataTransformerID.noop
) {
  const dataFrameCsv = toCSV([dataFrame], csvConfig);
  const bomChar = csvConfig?.useExcelHeader ? String.fromCharCode(0xfeff) : '';

  const blob = new Blob([bomChar, dataFrameCsv], {
    type: 'text/csv;charset=utf-8',
  });

  const transformation = transformId !== DataTransformerID.noop ? '-as-' + transformId.toLocaleLowerCase() : '';
  const fileName = `${title}-data${transformation}-${dateTimeFormat(new Date())}.csv`;
  saveAs(blob, fileName);
}

/**
 * Downloads any object as JSON file.
 *
 * @param {unknown} json
 * @param {string} title
 */
export function downloadAsJson(json: unknown, title: string) {
  const blob = new Blob([JSON.stringify(json)], {
    type: 'application/json',
  });

  const fileName = `${title}-${dateTimeFormat(new Date())}.json`;
  saveAs(blob, fileName);
}
