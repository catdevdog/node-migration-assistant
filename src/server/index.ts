import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import projectRouter from './routes/project.js';
import fileRouter from './routes/file.js';
import dependencyRouter from './routes/dependency.js';
import aiRouter from './routes/ai.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  projectPath: string;
  port: number;
  dev?: boolean;
}

export function createServer(options: ServerOptions): Promise<http.Server> {
  const { projectPath, port, dev } = options;
  const app = express();

  // 프로젝트 경로를 app.locals에 저장
  app.locals.projectPath = projectPath;

  // 미들웨어
  app.use(express.json({ limit: '10mb' }));

  // 개발 모드에서 CORS 허용
  if (dev) {
    app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      if (_req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  // API 라우트
  app.use('/api/project', projectRouter);
  app.use('/api/file', fileRouter);
  app.use('/api/deps', dependencyRouter);
  app.use('/api/ai', aiRouter);

  // 프로덕션: 정적 파일 서빙
  if (!dev) {
    const clientDist = path.join(__dirname, '..', 'client');
    app.use(express.static(clientDist));
    // SPA 폴백
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // 에러 핸들러
  app.use(errorHandler);

  return new Promise((resolve) => {
    const server = app.listen(port, '127.0.0.1', () => {
      logger.info(`서버 시작: http://localhost:${port}`);
      resolve(server);
    });
  });
}
