import chalk from 'chalk';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const PREFIXES: Record<LogLevel, string> = {
  info: chalk.blue('[정보]'),
  warn: chalk.yellow('[경고]'),
  error: chalk.red('[에러]'),
  debug: chalk.gray('[디버그]'),
};

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toLocaleTimeString('ko-KR');
  const prefix = PREFIXES[level];
  console.log(`${chalk.dim(timestamp)} ${prefix} ${message}`, ...args);
}

export const logger = {
  info: (msg: string, ...args: unknown[]) => log('info', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log('warn', msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),
  debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
};
