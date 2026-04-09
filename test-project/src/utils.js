var path = require('path');
var util = require('util');
var fs = require('fs');

// util deprecated 함수 다수 사용 — Node 12 레거시 코드 전형
function validateInput(value) {
  if (util.isUndefined(value)) {
    throw new Error('값이 필요합니다');
  }
  if (util.isNullOrUndefined(value)) {
    throw new Error('null 또는 undefined');
  }
  if (util.isNumber(value)) {
    return Number(value);
  }
  if (util.isBoolean(value)) {
    return Boolean(value);
  }
  if (util.isObject(value)) {
    return JSON.stringify(value);
  }
  if (util.isFunction(value)) {
    return value.toString();
  }
  if (util.isDate(value)) {
    return value.toISOString();
  }
  if (util.isRegExp(value)) {
    return value.source;
  }
  if (util.isError(value)) {
    return value.message;
  }
  if (util.isBuffer(value)) {
    return value.toString('utf-8');
  }
  return String(value);
}

// 동적 require — 런타임 플러그인 로딩
function loadPlugin(name) {
  var pluginPath = path.join(__dirname, 'plugins', name);
  return require(pluginPath);
}

// 조건부 require
var optionalDep;
try {
  optionalDep = require('optional-module');
} catch (e) {
  optionalDep = null;
}

// trimLeft/trimRight
function sanitize(input) {
  return input.trimLeft().trimRight();
}

function padAndTrim(str) {
  return ('  ' + str + '  ').trimLeft().trimRight();
}

// Buffer deprecated 사용
function toBase64(str) {
  return new Buffer(str).toString('base64');
}

function fromBase64(b64) {
  return new Buffer(b64, 'base64').toString('utf-8');
}

function createHash(data) {
  return new Buffer(data, 'utf-8');
}

// __dirname 사용
var configDir = path.resolve(__dirname, '..', 'config');

// 콜백 fs
function readConfig(name, cb) {
  var filePath = path.join(configDir, name + '.json');
  fs.readFile(filePath, 'utf-8', function (err, raw) {
    if (err) return cb(err);
    try {
      cb(null, JSON.parse(raw));
    } catch (e) {
      cb(e);
    }
  });
}

module.exports = {
  validateInput: validateInput,
  loadPlugin: loadPlugin,
  sanitize: sanitize,
  padAndTrim: padAndTrim,
  toBase64: toBase64,
  fromBase64: fromBase64,
  createHash: createHash,
  readConfig: readConfig
};
