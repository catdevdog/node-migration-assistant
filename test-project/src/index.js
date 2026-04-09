var fs = require('fs');
var path = require('path');
var http = require('http');

// Node 12 시절 전형적 패턴
var configFile = path.join(__dirname, 'config.json');
var buf = new Buffer('application startup');

fs.readFile(configFile, 'utf-8', function (err, data) {
  if (err) {
    console.error('설정 로드 실패:', err);
    return;
  }
  console.log('설정 로드 완료');
});

var server = http.createServer(function (req, res) {
  var body = new Buffer(0);
  req.on('data', function (chunk) {
    body = Buffer.concat([body, chunk]);
  });
  req.on('end', function () {
    res.writeHead(200);
    res.end('OK');
  });
});

server.listen(3000, function () {
  console.log('서버 시작: http://localhost:3000');
});
