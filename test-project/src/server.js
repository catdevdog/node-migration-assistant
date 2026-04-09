var express = require('express');
var fs = require('fs');
var path = require('path');
var util = require('util');
var crypto = require('crypto');

var app = express();

// Buffer 생성자 (deprecated since Node 6, 제거 예정)
var sessionKey = new Buffer(32);
var headerBuf = new Buffer('X-Custom-Header: value');

// __dirname, __filename
var viewsDir = path.join(__dirname, 'views');
var logFile = path.join(__dirname, '..', 'logs', 'app.log');
console.log('스크립트:', __filename);

// 콜백 스타일 fs — Node 12에서 흔한 패턴
fs.readdir(viewsDir, function (err, files) {
  if (err) {
    util.log('뷰 디렉토리 읽기 실패');
    return;
  }
  files.forEach(function (f) {
    console.log('뷰 파일:', f);
  });
});

fs.stat(logFile, function (err, stats) {
  if (!err) {
    console.log('로그 크기:', stats.size);
  }
});

fs.writeFile(logFile, 'server started\n', function (err) {
  if (err) util.log('로그 기록 실패');
});

// util deprecated 함수들
function handleRequest(input) {
  if (util.isArray(input)) {
    return input.map(String);
  }
  if (util.isString(input)) {
    return input.trimLeft();
  }
  if (util.isNumber(input)) {
    return input.toFixed(2);
  }
  if (util.isNull(input) || util.isUndefined(input)) {
    return '';
  }
  return String(input);
}

// trimLeft/trimRight (deprecated alias)
app.use(function (req, res, next) {
  if (req.headers['x-token']) {
    req.token = req.headers['x-token'].trimLeft().trimRight();
  }
  next();
});

// crypto deprecated API — Node 12에서 경고만, 이후 제거
function encrypt(text, password) {
  var cipher = crypto.createCipher('aes-256-cbc', password);
  var encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(hash, password) {
  var decipher = crypto.createDecipher('aes-256-cbc', password);
  var decrypted = decipher.update(hash, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// process.binding (internal API)
var constants = process.binding('constants');

app.get('/', function (req, res) {
  res.send('Hello from Node 12 app');
});

app.listen(3000, function () {
  util.log('서버 시작: http://localhost:3000');
});

module.exports = app;
