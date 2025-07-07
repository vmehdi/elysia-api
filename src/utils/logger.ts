import { logBroadcaster } from '@/app/plugins/live-logger';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
  level: 'info',
});

type LogMethod = (...args: unknown[]) => void;

const levels = ['info', 'warn', 'error', 'debug'] as const;

for (const level of levels) {
  const original = logger[level].bind(logger) as LogMethod;

  (logger as any)[level] = (...args: unknown[]) => {
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const text = `${timestamp} | ${level.toUpperCase()} | ${message}`;

    logBroadcaster.broadcast(text);

    return original(...args);
  };
}

export default logger;