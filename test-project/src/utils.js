const path = require('path');
const fs = require('fs').promises;
const lodash = require('lodash');
const moment = require('moment');
const appConfig = require('./config');

// util deprecated 함수를 네이티브 JavaScript로 교체
function validateInput(value) {
  if (value === undefined) {
    throw new Error('값이 필요합니다');
  }
  if (value === null || value === undefined) {
    throw new Error('null 또는 undefined');
  }
  if (typeof value === 'number') {
    return Number(value);
  }
  if (typeof value === 'boolean') {
    return Boolean(value);
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'function') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof RegExp) {
    return value.source;
  }
  if (value instanceof Error) {
    return value.message;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('utf-8');
  }
  return String(value);
}

// 동적 require 안전하게 처리
function loadPlugin(name) {
  const pluginPath = path.join(__dirname, 'plugins', name);
  try {
    return require(pluginPath);
  } catch (error) {
    throw new Error(`플러그인 로딩 실패: ${name} - ${error.message}`);
  }
}

// 조건부 require 개선
let optionalDep;
try {
  optionalDep = require('optional-module');
} catch (e) {
  optionalDep = null;
}

// trimLeft/trimRight (deprecated — 정식 이름은 trimStart/trimEnd)
function sanitize(input) {
  return input.trimLeft().trimRight();
}

function padAndTrim(str) {
  return ('  ' + str + '  ').trimLeft().trimRight();
}

// Buffer deprecated 생성자
function toBase64(str) {
  return new Buffer(str).toString('base64');
}

function fromBase64(b64) {
  return new Buffer(b64, 'base64').toString('utf-8');
}

function createHash(data) {
  return new Buffer(data, 'utf-8');
}

// __dirname 사용 (CommonJS 글로벌)
const configDir = path.resolve(__dirname, '..', 'config');

// Promise 기반으로 변경
async function readConfig(name) {
  const filePath = path.join(configDir, name + '.json');
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`설정 파일 읽기 실패: ${name} - ${error.message}`);
  }
}

// 콜백 버전도 유지 (하위 호환성)
function readConfigCallback(name, cb) {
  readConfig(name)
    .then(result => cb(null, result))
    .catch(error => cb(error));
}

// lodash 사용법은 올바름
function mergeDefaults(obj, defaults) {
  return lodash.defaultsDeep({}, obj, defaults);
}

function pickFields(obj, fields) {
  return lodash.pick(obj, fields);
}

// moment 사용법은 올바름
function formatDate(date) {
  return moment(date).format('YYYY-MM-DD HH:mm:ss');
}

function getRelativeTime(date) {
  return moment(date).fromNow();
}

// config 참조 개선
function getLogPath() {
  if (!appConfig.config || !appConfig.config.logDir) {
    throw new Error('로그 디렉토리 설정이 없습니다');
  }
  return path.join(appConfig.config.logDir, 'app-' + moment().format('YYYYMMDD') + '.log');
}

module.exports = {
  validateInput,
  loadPlugin,
  sanitize,
  padAndTrim,
  toBase64,
  fromBase64,
  createHash,
  readConfig,
  readConfigCallback,
  mergeDefaults,
  pickFields,
  formatDate,
  getRelativeTime,
  getLogPath,
};
