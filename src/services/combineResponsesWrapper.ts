// @ts-expect-error
import Worker from 'comlink-loader!./combineResponsesWorker';

export const combineResponsesWorker = Worker ? new Worker() : undefined;
