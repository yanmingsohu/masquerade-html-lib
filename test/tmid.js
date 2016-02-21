var port = 8088;

//useExpress();
useNative();

setTimeout(function() {
  console.log('memory:', process.memoryUsage());
}, 1000);


// 23.6 mb
// memory: { rss: 33644544, heapTotal: 30566144, heapUsed: 11992520 }
function useExpress() {
  var express = require('express');
  var app = express();
  var mas = require('../lib/mid.js');
  var mid = mas('/');
  // mid.add_plugin(require('mas-plugin-sql-lib'));
  app.use(mid);
  app.listen(port);
  
  console.log('Express server on port', port);
}


// 16.8 mb
// memory: { rss: 26091520, heapTotal: 18061824, heapUsed: 8971656 }
function useNative() {
  var http = require('http');
  var mas  = require('../lib/mid.js');
  var mid = mas('/');

  http.createServer(mid).listen(port);
  console.log('Native server on port', port);
}
