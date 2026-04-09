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

/** 포트가 사용 가능한지 확인 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

/** 사용 가능한 포트 찾기 (최대 10번 시도) */
async function findPort(startPort: number): Promise<number> {
  for (let p = startPort; p < startPort + 10; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(`포트 ${startPort}~${startPort + 9} 모두 사용 중입니다.`);
}

/** 배너 출력 */
function printBanner(projectPath: string, port: number, dev: boolean): void {
  console.log('');
  console.log(chalk.bold.cyan('  ╔══════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║') + chalk.bold.white('   Node Migration Assistant v0.1.0   ') + chalk.bold.cyan('     ║'));
  console.log(chalk.bold.cyan('  ║') + chalk.dim('   Node.js 마이그레이션 워크벤치       ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('  ╚══════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.dim('  프로젝트: ') + chalk.white(projectPath));
  console.log(chalk.dim('  API 서버: ') + chalk.green(`http://localhost:${port}`));
  if (dev) {
    console.log(chalk.dim('  클라이언트:') + chalk.green(` http://localhost:5173`) + chalk.dim(' (Vite 프록시 → :' + port + ')'));
  }
  console.log('');
  console.log(chalk.dim('  종료하려면 Ctrl+C를 누르세요.'));
  console.log('');
}

program
  .name('node-migrator')
  .description('Node.js 마이그레이션 분석 및 반자동 변환 워크벤치')
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

    const requestedPort = parseInt(opts.port, 10);
    let port: number;

    if (opts.dev) {
      // 개발 모드: Vite 프록시와 포트가 일치해야 하므로 고정 포트 사용
      if (await isPortFree(requestedPort)) {
        port = requestedPort;
      } else {
        console.error(chalk.red(`에러: 포트 ${requestedPort}이(가) 사용 중입니다.`));
        console.error(chalk.yellow(`  Vite 프록시가 :${requestedPort}을(를) 사용하므로 개발 모드에서는 포트를 변경할 수 없습니다.`));
        console.error(chalk.yellow(`  해결: 기존 프로세스를 종료하거나 --port 옵션으로 다른 포트를 지정하세요.`));
        console.error(chalk.dim(`  Windows: netstat -ano | findstr ${requestedPort}`));
        console.error(chalk.dim(`  taskkill /PID <PID> /F`));
        process.exit(1);
      }
    } else {
      // 프로덕션 모드: 자동 포트 탐색
      port = await findPort(requestedPort);
      if (port !== requestedPort) {
        console.log(chalk.yellow(`포트 ${requestedPort}이(가) 사용 중입니다. ${port}을(를) 사용합니다.`));
      }
    }

    // 서버 시작
    const server = await createServer({
      projectPath: resolvedPath,
      port,
      dev: opts.dev,
    });

    printBanner(resolvedPath, port, opts.dev);

    // 브라우저 열기
    if (opts.open) {
      const url = opts.dev ? `http://localhost:5173` : `http://localhost:${port}`;
      await open(url);
    }

    // 그레이스풀 셧다운
    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(chalk.dim('\n서버를 종료합니다...'));
      server.close(() => {
        process.exit(0);
      });
      // 3초 내에 안 닫히면 강제 종료
      setTimeout(() => {
        console.log(chalk.yellow('강제 종료합니다.'));
        process.exit(1);
      }, 3000).unref();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    // Windows에서 터미널 닫힘 감지
    process.on('SIGHUP', shutdown);
  });

program.parse();
