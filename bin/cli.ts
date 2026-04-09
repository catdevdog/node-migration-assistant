#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import net from 'net';
import open from 'open';
import { createServer } from '../src/server/index.js';
import { DEFAULT_PORT } from '../src/shared/constants.js';

const program = new Command();

/** 사용 가능한 포트 찾기 */
function findPort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      // 포트 사용 중이면 다음 포트 시도
      resolve(findPort(startPort + 1));
    });
    server.listen(startPort, '127.0.0.1', () => {
      server.close(() => resolve(startPort));
    });
  });
}

/** 배너 출력 */
function printBanner(projectPath: string, port: number): void {
  console.log('');
  console.log(chalk.bold.cyan('  ╔══════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║') + chalk.bold.white('   Node Migration Assistant v0.1.0   ') + chalk.bold.cyan('     ║'));
  console.log(chalk.bold.cyan('  ║') + chalk.dim('   Node.js 마이그레이션 자동화 도구    ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('  ╚══════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.dim('  프로젝트: ') + chalk.white(projectPath));
  console.log(chalk.dim('  서버:     ') + chalk.green(`http://localhost:${port}`));
  console.log('');
  console.log(chalk.dim('  종료하려면 Ctrl+C를 누르세요.'));
  console.log('');
}

program
  .name('node-migrator')
  .description('Node.js 마이그레이션 자동화 도구')
  .version('0.1.0')
  .argument('<project-path>', '마이그레이션할 프로젝트 경로')
  .option('-p, --port <number>', '서버 포트', String(DEFAULT_PORT))
  .option('--no-open', '브라우저 자동 열기 비활성화')
  .option('--dev', '개발 모드 (Vite 프록시 사용)')
  .action(async (projectPath: string, opts: { port: string; open: boolean; dev: boolean }) => {
    // 프로젝트 경로 검증
    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(chalk.red(`에러: 경로를 찾을 수 없습니다 — ${resolvedPath}`));
      process.exit(1);
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
      console.error(chalk.red(`에러: 디렉토리가 아닙니다 — ${resolvedPath}`));
      process.exit(1);
    }

    // 포트 찾기
    const requestedPort = parseInt(opts.port, 10);
    const port = await findPort(requestedPort);

    if (port !== requestedPort) {
      console.log(chalk.yellow(`포트 ${requestedPort}이(가) 사용 중입니다. ${port}을(를) 사용합니다.`));
    }

    // 서버 시작
    const server = await createServer({
      projectPath: resolvedPath,
      port,
      dev: opts.dev,
    });

    printBanner(resolvedPath, port);

    // 브라우저 열기
    if (opts.open) {
      const url = opts.dev ? `http://localhost:5173` : `http://localhost:${port}`;
      await open(url);
    }

    // 그레이스풀 셧다운
    const shutdown = () => {
      console.log(chalk.dim('\n서버를 종료합니다...'));
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program.parse();
