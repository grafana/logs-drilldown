// @ts-ignore no-default-export
import worker from 'workerize-loader?ready!./combineResponsesWorker';

export const combineResponsesWorker = worker();
