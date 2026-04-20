var path = require('path');
var fs = require('fs');

// 설정 파일 — 여러 모듈에서 참조하는 공유 설정
// __dirname 사용 (Node 12 CJS 글로벌)
var configDir = path.join(__dirname, '..', 'config');
var envFile = path.join(__dirname, '..', '.env');

// Buffer deprecated 생성자 — 설정 인코딩
var APP_NAME = new Buffer('legacy-app').toString('utf-8');
var SECRET_KEY = new Buffer('c2VjcmV0LWtleS0xMjM=', 'base64').toString('utf-8');

var config = {
  appName: APP_NAME,
  secretKey: SECRET_KEY,
  port: 3000,
  dbPath: path.join(__dirname, '..', 'data', 'db.json'),
  logDir: path.join(__dirname, '..', 'logs'),
  cacheDir: path.join(__dirname, '..', '.cache'),
  maxRetries: 3,
  timeout: 5000,
};

// 콜백 스타일 fs — 설정 파일 로드
function loadEnv(callback) {
  fs.readFile(envFile, 'utf-8', function (err, data) {
    if (err) {
      callback(err, null);
      return;
    }
    var envVars = {};
    data.split('\n').forEach(function (line) {
      var parts = line.split('=');
      if (parts.length >= 2) {
        envVars[parts[0].trimLeft().trimRight()] = parts.slice(1).join('=').trimLeft().trimRight();
      }
    });
    callback(null, envVars);
  });
}

function saveConfig(data, callback) {
  var configPath = path.join(configDir, 'app.json');
  var json = JSON.stringify(data, null, 2);
  fs.writeFile(configPath, json, 'utf-8', function (err) {
    callback(err);
  });
}

module.exports = {
  config: config,
  loadEnv: loadEnv,
  saveConfig: saveConfig,
};
