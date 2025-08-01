// @ts-expect-error
import Worker from 'comlink-loader!./combineResponsesWorker';

export const CombineResponsesWorker = Worker ? Worker : undefined;
