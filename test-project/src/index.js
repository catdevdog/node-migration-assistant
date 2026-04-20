var fs = require('fs');
var path = require('path');
var http = require('http');
var moment = require('moment');
var lodash = require('lodash');
var uuid = require('uuid');
var utils = require('./utils');
var database = require('./database');
var appConfig = require('./config');
var app = require('./server');

// Node 12 시절 전형적 패턴
// __dirname 사용 (CJS 글로벌)
var configFile = path.join(__dirname, 'config.json');
var dataDir = path.join(__dirname, '..', 'data');

// Buffer deprecated 생성자
var buf = new Buffer('application startup');
var startupId = new Buffer(uuid.v4()).toString('base64');

// 콜백 스타일 fs
fs.readFile(configFile, 'utf-8', function (err, data) {
  if (err) {
    console.error('설정 로드 실패:', err);
    return;
  }
  console.log('설정 로드 완료');
});

// 디렉토리 존재 확인 (콜백 fs)
fs.stat(dataDir, function (err, stats) {
  if (err) {
    fs.mkdir(dataDir, { recursive: true }, function (mkdirErr) {
      if (mkdirErr) console.error('디렉토리 생성 실패:', mkdirErr);
    });
  }
});

// moment 활용 — 시작 시간 기록
var startTime = moment();
console.log('앱 시작:', utils.formatDate(new Date()));
console.log('시작 ID:', startupId);

// lodash 활용 — 설정 병합
var defaultOptions = {
  verbose: false,
  maxConnections: 10,
  retryCount: 3,
  logLevel: 'info',
};

var userOptions = { verbose: true, logLevel: 'debug' };
var mergedOptions = lodash.defaultsDeep({}, userOptions, defaultOptions);
console.log('적용된 설정:', JSON.stringify(mergedOptions));

// database 모듈 활용 — 초기화
database.loadDatabase(function (err, db) {
  if (err) {
    console.error('DB 초기화 실패:', err);
    return;
  }
  var recordCount = lodash.get(db, 'records.length', 0);
  console.log('DB 로드 완료. 레코드:', recordCount);

  // 유효성 검사 — utils 모듈 활용
  if (db.records) {
    var validRecords = db.records.filter(function (r) {
      return database.isValidRecord(r);
    });
    console.log('유효한 레코드:', validRecords.length);
  }
});

// 업타임 체크 — moment + lodash
setInterval(function () {
  var uptime = moment.duration(moment().diff(startTime));
  var uptimeStr = lodash.compact([
    uptime.hours() > 0 ? uptime.hours() + '시간' : null,
    uptime.minutes() + '분',
    uptime.seconds() + '초',
  ]).join(' ');
  console.log('업타임:', uptimeStr);
}, 60000);

// config 모듈 활용 — 환경 변수 로드
appConfig.loadEnv(function (err, envVars) {
  if (err) {
    console.log('환경 변수 파일 없음 (기본값 사용)');
  } else {
    console.log('환경 변수 로드:', Object.keys(envVars).length + '개');
  }
});

// 애플리케이션 종료 처리
process.on('SIGINT', function () {
  var shutdownTime = utils.formatDate(new Date());
  console.log('종료 시작:', shutdownTime);
  database.backupDatabase(function (err) {
    if (err) console.error('종료 전 백업 실패:', err);
    process.exit(0);
  });
});
