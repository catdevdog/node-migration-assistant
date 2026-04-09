var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var util = require('util');

// crypto deprecated — Node 12에서 경고 출력
function hashPassword(password) {
  var cipher = crypto.createCipher('aes-256-cbc', 'app-secret-key');
  var encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function verifyPassword(hash, password) {
  var decipher = crypto.createDecipher('aes-256-cbc', 'app-secret-key');
  var decrypted = decipher.update(hash, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted === password;
}

// process.binding (internal, 제거 예정)
var fsBinding = process.binding('fs');
var constants = process.binding('constants');

// __dirname + 콜백 fs
var dbPath = path.join(__dirname, '..', 'data', 'db.json');
var backupDir = path.join(__dirname, '..', 'data', 'backups');

function loadDatabase(callback) {
  fs.readFile(dbPath, 'utf-8', function (err, raw) {
    if (err) {
      callback(err, null);
      return;
    }
    try {
      callback(null, JSON.parse(raw));
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
  var timestamp = Date.now();
  var dest = path.join(backupDir, 'db-' + timestamp + '.json');
  fs.readFile(dbPath, function (err, buf) {
    if (err) return callback(err);
    fs.writeFile(dest, buf, function (writeErr) {
      callback(writeErr);
    });
  });
}

// Buffer deprecated
function serializeRecord(record) {
  return new Buffer(JSON.stringify(record)).toString('base64');
}

function deserializeRecord(b64) {
  var raw = new Buffer(b64, 'base64').toString('utf-8');
  return JSON.parse(raw);
}

// util deprecated
function isValidRecord(record) {
  if (util.isNullOrUndefined(record)) return false;
  if (!util.isObject(record)) return false;
  if (util.isArray(record)) return false;
  if (util.isDate(record)) return false;
  return true;
}

module.exports = {
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  loadDatabase: loadDatabase,
  saveDatabase: saveDatabase,
  backupDatabase: backupDatabase,
  serializeRecord: serializeRecord,
  deserializeRecord: deserializeRecord,
  isValidRecord: isValidRecord
};
