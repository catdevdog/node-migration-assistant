import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// __dirname 사용 — CJS 스타일 TypeScript (Node 12 + ts-node)
const templateDir = path.resolve(__dirname, '../templates');
const cacheDir = path.join(__dirname, '../.cache');
const currentScript = __filename;

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

// Buffer deprecated
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

// trimLeft/trimRight
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
  } else if (util.isArray(value)) {
    util.log(`${label}: [${(value as unknown[]).length} items]`);
  } else {
    util.log(`${label}: ${JSON.stringify(value)}`);
  }
}

export { loadTemplate, checkFile, ensureDir, createToken, decodeToken, parseHeader, logValue };
