import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// __dirname, __filename 사용 — CJS 스타일 TypeScript (Node 12 + ts-node)
const templateDir = path.resolve(__dirname, '../templates');
const cacheDir = path.join(__dirname, '../.cache');
const currentScript = __filename;

// 로컬 모듈 참조 (동적 require — TypeScript에서 CJS 패턴)
const utils = require('./utils');
const helpers = require('./helpers');

// 콜백 스타일 fs
function loadTemplate(name: string, callback: (err: Error | null, content?: string) => void): void {
  const filePath = path.join(templateDir, `${name}.html`);

  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, data);
  });
}

// fs.exists (deprecated since Node 4)
function checkFile(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    fs.exists(filePath, (exists) => {
      resolve(exists);
    });
  });
}

function ensureDir(dirPath: string, cb: (err: NodeJS.ErrnoException | null) => void): void {
  fs.stat(dirPath, (err) => {
    if (err) {
      fs.mkdir(dirPath, { recursive: true }, cb);
    } else {
      cb(null);
    }
  });
}

// Buffer deprecated 생성자
function createToken(payload: string): string {
  const header = new Buffer(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
  const body = new Buffer(payload).toString('base64');
  const sig = new Buffer('').toString('base64');
  return `${header}.${body}.${sig}`;
}

function decodeToken(token: string): string {
  const parts = token.split('.');
  return new Buffer(parts[1], 'base64').toString('utf-8');
}

// trimLeft/trimRight (deprecated)
function parseHeader(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = raw.split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length > 0) {
      headers[key.trimRight()] = rest.join(':').trimLeft();
    }
  }
  return headers;
}

// util deprecated
function logValue(label: string, value: unknown): void {
  if (util.isString(value)) {
    util.log(`${label}: "${value}"`);
  } else if (util.isNumber(value)) {
    util.log(`${label}: ${value}`);
  } else if (Array.isArray(value)) {
    util.log(`${label}: [${(value as unknown[]).length} items]`);
  } else {
    util.log(`${label}: ${JSON.stringify(value)}`);
  }
}

// Express 미들웨어 — utils, helpers 모듈 활용
function authMiddleware(req: any, res: any, next: any): void {
  const token = req.headers['authorization'];
  if (!token) {
    res.status(401).json({ error: '인증 토큰 필요' });
    return;
  }

  try {
    const cleaned = utils.sanitize(token.replace('Bearer ', ''));
    const decoded = decodeToken(cleaned);
    req.user = JSON.parse(decoded);
    logValue('인증된 사용자', req.user.name);
    next();
  } catch (err) {
    res.status(401).json({ error: '유효하지 않은 토큰' });
  }
}

function requestLogger(req: any, res: any, next: any): void {
  const cleanHeaders = helpers.cleanHeaders(
    Object.entries(req.headers)
      .map(([k, v]: [string, any]) => `${k}: ${v}`)
      .join('\n')
  );
  util.log(`${req.method} ${req.url}`);
  logValue('헤더', cleanHeaders);
  next();
}

// 캐시 미들웨어 — 콜백 fs + __dirname
function cacheMiddleware(req: any, res: any, next: any): void {
  const cacheKey = utils.toBase64(req.url);
  const cacheFile = path.join(cacheDir, cacheKey + '.json');

  checkFile(cacheFile).then((exists) => {
    if (exists) {
      fs.readFile(cacheFile, 'utf-8', (err, data) => {
        if (err) return next();
        try {
          res.json(JSON.parse(data));
        } catch {
          next();
        }
      });
    } else {
      next();
    }
  });
}

export {
  loadTemplate, checkFile, ensureDir, createToken, decodeToken,
  parseHeader, logValue, authMiddleware, requestLogger, cacheMiddleware,
};
