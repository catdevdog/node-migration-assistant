var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var util = require('util');
var lodash = require('lodash');
var Bluebird = require('bluebird');
var async = require('async');
var utils = require('./utils');
var appConfig = require('./config');

// crypto deprecated — Node 12에서 경고 출력
function hashPassword(password) {
  var cipher = crypto.createCipher('aes-256-cbc', appConfig.config.secretKey);
  var encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function verifyPassword(hash, password) {
  var decipher = crypto.createDecipher('aes-256-cbc', appConfig.config.secretKey);
  var decrypted = decipher.update(hash, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted === password;
}

// process.binding (internal, 제거 예정)
var fsBinding = process.binding('fs');
var constants = process.binding('constants');

// __dirname + 콜백 fs
var dbPath = appConfig.config.dbPath;
var backupDir = path.join(import.meta.dirname, '..', 'data', 'backups');

function loadDatabase(callback) {
  fs.readFile(dbPath, 'utf-8', function (err, raw) {
    if (err) {
      callback(err, null);
      return;
    }
    try {
      var data = JSON.parse(raw);
      // lodash를 사용하여 데이터 정규화
      var normalized = lodash.mapValues(data, function (collection) {
        if (lodash.isArray(collection)) {
          return lodash.sortBy(collection, 'id');
        }
        return collection;
      });
      callback(null, normalized);
    } catch (parseErr) {
      callback(parseErr, null);
    }
  });
}

function saveDatabase(data, callback) {
  var json = JSON.stringify(data, null, 2);
  fs.writeFile(dbPath, json, 'utf-8', function (err) {
    callback(err);
  });
}

function backupDatabase(callback) {
  var timestamp = utils.formatDate(new Date()).replace(/[: ]/g, '-');
  var dest = path.join(backupDir, 'db-' + timestamp + '.json');
  fs.readFile(dbPath, function (err, buf) {
    if (err) return callback(err);
    fs.writeFile(dest, buf, function (writeErr) {
      callback(writeErr);
    });
  });
}

// Buffer deprecated 생성자
function serializeRecord(record) {
  return Buffer.from(JSON.stringify(record)).toString('base64');
}

function deserializeRecord(b64) {
  var raw = Buffer.from(b64, 'base64').toString('utf-8');
  return JSON.parse(raw);
}

// util deprecated
function isValidRecord(record) {
  if (util.isNullOrUndefined(record)) return false;
  if (!util.isObject(record)) return false;
  if (Array.isArray(record)) return false;
  if (util.isDate(record)) return false;
  return true;
}

// bluebird — Promise 기반 DB 작업 (레거시 패턴)
var loadDatabaseAsync = Bluebird.promisify(loadDatabase);
var saveDatabaseAsync = Bluebird.promisify(saveDatabase);
var backupDatabaseAsync = Bluebird.promisify(backupDatabase);

// async 라이브러리 — 순차 처리 (레거시 패턴)
function batchInsert(records, callback) {
  loadDatabase(function (err, db) {
    if (err) return callback(err);

    var validated = records.filter(function (r) {
      return isValidRecord(r) && utils.validateInput(r.name);
    });

    async.eachSeries(validated, function (record, next) {
      record.hash = hashPassword(record.id || 'unknown');
      record.serialized = serializeRecord(record);
      record.createdAt = utils.formatDate(new Date());
      if (!db.records) db.records = [];
      db.records.push(record);
      next();
    }, function (asyncErr) {
      if (asyncErr) return callback(asyncErr);
      saveDatabase(db, callback);
    });
  });
}

// 검색 기능 — lodash 활용
function findRecords(query) {
  return loadDatabaseAsync().then(function (db) {
    var records = db.records || [];
    return lodash.filter(records, function (r) {
      return lodash.some(Object.keys(query), function (key) {
        return r[key] === query[key];
      });
    });
  });
}

module.exports = {
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  loadDatabase: loadDatabase,
  saveDatabase: saveDatabase,
  backupDatabase: backupDatabase,
  serializeRecord: serializeRecord,
  deserializeRecord: deserializeRecord,
  isValidRecord: isValidRecord,
  loadDatabaseAsync: loadDatabaseAsync,
  saveDatabaseAsync: saveDatabaseAsync,
  backupDatabaseAsync: backupDatabaseAsync,
  batchInsert: batchInsert,
  findRecords: findRecords,
};
