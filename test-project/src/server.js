var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var path = require('path');
var url = require('url');
var querystring = require('querystring');
var util = require('util');
var crypto = require('crypto');
var utils = require('./utils');
var database = require('./database');
var helpers = require('./helpers');
var appConfig = require('./config');

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Buffer deprecated 생성자 (Node 6에서 deprecated, 이후 제거 예정)
var sessionKey = Buffer.alloc(32);
var headerBuf = Buffer.from('X-Custom-Header: value');

// __dirname, __filename (CJS 글로벌)
var viewsDir = path.join(import.meta.dirname, 'views');
var logFile = path.join(appConfig.config.logDir, 'app.log');
console.log('스크립트:', import.meta.filename);

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
  if (Array.isArray(input)) {
    return input.map(String);
  }
  if (util.isString(input)) {
    return input.trimStart();
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
    req.token = req.headers['x-token'].trimStart().trimEnd();
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

// --- Express 라우트: utils, database, helpers 모듈 활용 ---

app.get('/', function (req, res) {
  res.send('Hello from Node 12 app — ' + appConfig.config.appName);
});

app.get('/api/records', function (req, res) {
  database.loadDatabase(function (err, db) {
    if (err) {
      util.log('DB 로드 실패');
      return res.status(500).json({ error: '데이터베이스 오류' });
    }
    var records = db.records || [];
    // utils 모듈 활용
    var formatted = records.map(function (r) {
      return {
        id: r.id,
        name: utils.sanitize(r.name || ''),
        createdAt: utils.formatDate(r.createdAt),
        timeAgo: utils.getRelativeTime(r.createdAt),
      };
    });
    res.json(formatted);
  });
});

app.post('/api/records', function (req, res) {
  var body = req.body;
  if (!utils.validateInput(body.name)) {
    return res.status(400).json({ error: '이름이 필요합니다' });
  }
  // helpers 모듈 활용
  var transformed = helpers.transformRecords([body]);
  database.batchInsert(transformed, function (err) {
    if (err) {
      return res.status(500).json({ error: '저장 실패' });
    }
    res.json({ success: true, data: transformed[0] });
  });
});

app.get('/api/records/search', function (req, res) {
  // url.parse + querystring — Node 12 전형적 패턴
  var parsed = url.parse(req.url, true);
  var qs = querystring.parse(parsed.search ? parsed.search.slice(1) : '');
  var query = qs.q ? { q: qs.q } : req.query;
  database.findRecords(query).then(function (results) {
    res.json(results);
  }).catch(function (err) {
    res.status(500).json({ error: err.message });
  });
});

app.get('/api/redirect', function (req, res) {
  // url.resolve — deprecated
  var target = url.resolve(appConfig.config.baseUrl || 'http://localhost', req.query.path || '/');
  res.redirect(target);
});

app.post('/api/backup', function (req, res) {
  database.backupDatabase(function (err) {
    if (err) {
      util.log('백업 실패: ' + err.message);
      return res.status(500).json({ error: '백업 실패' });
    }
    res.json({ success: true, message: '백업 완료' });
  });
});

app.get('/api/config/remote', function (req, res) {
  var url = req.query.url;
  if (!url) return res.status(400).json({ error: 'url 파라미터 필요' });
  helpers.fetchRemoteConfig(url, function (err, data) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
});

app.post('/api/encrypt', function (req, res) {
  var text = req.body.text;
  var password = req.body.password || appConfig.config.secretKey;
  var encrypted = encrypt(text, password);
  var encoded = helpers.encodePayload({ encrypted: encrypted });
  res.json({ result: encoded });
});

app.listen(appConfig.config.port, function () {
  util.log('서버 시작: http://localhost:' + appConfig.config.port);
});

module.exports = app;
