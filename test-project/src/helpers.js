var path = require('path');
var lodash = require('lodash');
var request = require('request');
var uuid = require('uuid');
var utils = require('./utils');
var appConfig = require('./config');

// 유틸리티 헬퍼 — utils, config에 의존하는 중간 계층

// Buffer deprecated 생성자
function encodePayload(data) {
  var json = JSON.stringify(data);
  return new Buffer(json).toString('base64');
}

function decodePayload(encoded) {
  var raw = new Buffer(encoded, 'base64').toString('utf-8');
  return JSON.parse(raw);
}

// lodash 활용 — 데이터 변환
function transformRecords(records) {
  return lodash.chain(records)
    .filter(function (r) { return utils.validateInput(r.name); })
    .map(function (r) {
      return lodash.assign({}, r, {
        id: r.id || uuid.v4(),
        name: utils.sanitize(r.name),
        updatedAt: new Date().toISOString(),
      });
    })
    .sortBy('name')
    .value();
}

// request (deprecated) 로 외부 API 호출
function fetchRemoteConfig(url, callback) {
  request.get({
    url: url,
    json: true,
    timeout: appConfig.config.timeout,
  }, function (err, res, body) {
    if (err) {
      callback(err, null);
      return;
    }
    if (res.statusCode !== 200) {
      callback(new Error('HTTP ' + res.statusCode), null);
      return;
    }
    callback(null, body);
  });
}

// POST 요청 헬퍼 — request (deprecated)
function postData(url, data, callback) {
  var payload = encodePayload(data);
  request.post({
    url: url,
    body: { data: payload },
    json: true,
    headers: {
      'X-Request-Id': uuid.v4(),
      'X-App-Name': appConfig.config.appName,
    },
  }, function (err, res, body) {
    if (err) return callback(err);
    callback(null, body);
  });
}

// trimLeft/trimRight (deprecated)
function cleanHeaders(headerStr) {
  var lines = headerStr.split('\n');
  var result = {};
  lines.forEach(function (line) {
    var idx = line.indexOf(':');
    if (idx > 0) {
      var key = line.substring(0, idx).trimRight();
      var val = line.substring(idx + 1).trimLeft();
      result[key] = val;
    }
  });
  return result;
}

// __dirname 사용 (CJS 글로벌)
var templatesDir = path.join(__dirname, 'templates');

function getTemplatePath(name) {
  return path.join(templatesDir, name + '.html');
}

module.exports = {
  encodePayload: encodePayload,
  decodePayload: decodePayload,
  transformRecords: transformRecords,
  fetchRemoteConfig: fetchRemoteConfig,
  postData: postData,
  cleanHeaders: cleanHeaders,
  getTemplatePath: getTemplatePath,
};
