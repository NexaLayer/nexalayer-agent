import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
});

export function createModuleLogger(module: string) {
  return logger.child({ module });
}
