import { LogContext, LogLevel } from '@grafana/faro-web-sdk';
import { FetchError } from '@grafana/runtime';

import packageJson from '../../package.json';
import { getFaro } from '../faro/faroInstance';
import pluginJson from '../plugin.json';
import { isRecord } from './narrowing';

const defaultContext = {
  app: pluginJson.id,
  version: packageJson.version,
};

export const logger = {
  error: (err: Error | unknown, context?: LogContext) => {
    attemptFaroErr(err, { ...defaultContext, ...context });
  },
  info: (msg: string, context?: LogContext) => {
    attemptFaroInfo(msg, { ...defaultContext, ...context });
  },
  warn: (msg: string, context?: LogContext) => {
    attemptFaroWarn(msg, { ...defaultContext, ...context });
  },
};

const attemptFaroInfo = (msg: string, context: LogContext) => {
  const faro = getFaro();
  if (!faro) {
    console.log(msg, context);
    return;
  }
  try {
    faro.api.pushLog([msg], {
      level: LogLevel.INFO,
      context,
    });
  } catch (e) {
    console.warn('Failed to log faro event!');
  }
};

const attemptFaroWarn = (msg: string, context: LogContext) => {
  const faro = getFaro();
  if (!faro) {
    console.warn(msg, context);
    return;
  }
  try {
    faro.api.pushLog([msg], {
      level: LogLevel.WARN,
      context,
    });
  } catch (e) {
    console.warn('Failed to log faro warning!', { context, msg });
  }
};
/**
 * Checks unknown error for properties from Records like FetchError and adds them to the context
 * @param err
 * @param context
 */
function populateFetchErrorContext(err: unknown | FetchError, context: LogContext) {
  if (typeof err === 'object' && err !== null) {
    if (isRecord(err)) {
      Object.keys(err).forEach((key: string) => {
        const value = err[key];
        if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
          context[key] = value.toString();
        }
      });
    }

    if (hasData(err)) {
      if (typeof err.data === 'object' && err.data !== null) {
        try {
          context.data = JSON.stringify(err.data);
        } catch (e) {
          // do nothing
        }
      } else if (typeof err.data === 'string' || typeof err.data === 'boolean' || typeof err.data === 'number') {
        context.data = err.data.toString();
      }
    }
  }
}

const attemptFaroErr = (err: Error | FetchError | unknown, context: LogContext) => {
  const faro = getFaro();
  if (!faro) {
    console.error(err, context);
    return;
  }
  try {
    populateFetchErrorContext(err, context);

    if (err instanceof Error) {
      faro.api.pushError(err, { context });
    } else if (typeof err === 'string') {
      faro.api.pushError(new Error(err), { context });
    } else if (err && typeof err === 'object') {
      if (context.msg) {
        faro.api.pushError(new Error(context.msg), { context });
      } else {
        faro.api.pushError(new Error('error object'), { context });
      }
    } else {
      faro.api.pushError(new Error('unknown error'), { context });
    }
  } catch (e) {
    console.error('Failed to log faro error!', { context, err });
  }
};

const hasData = (value: object): value is { data: unknown } => {
  return 'data' in value;
};
