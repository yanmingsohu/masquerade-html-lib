var tpl = require('../index.js').template;
var tool = require('../index.js').tool;
var fs   = require('fs');
var sysinstall = require('../lib/install-systag.js');
var count = 0;
var path = require('path');
var conf = require('configuration-lib');

var ext = '.' + conf.load().masquerade.extname;
var userTag = {};
var thecontext = { };
sysinstall(userTag);


var fcc = 0;
ext = '.html';
walk('../masquerade-scan-test', 0, renderFile);

// renderFile('./test/scantest/ajax/dashboard.html');
// renderFile('./demo/public/for.html');


function renderFile(file) {
  if (path.extname(file) != ext) return;
  try {
    // console.log('PARSE', file);
    var html = fs.readFileSync(file, {encoding: 'utf8'});
    var render = tpl.html_complier(html, userTag, errorHandle, file);
    var strbuf = tool.string_buf();
  } catch(E) {
    errorHandle(E);
  }

  tool.rendering(strbuf, thecontext, render, function(next, buf, context) {
    // console.log("\nOUT html:>>>>>>>>>>>>>\n", buf.toString(), "\n<<<<<<<<<<<<<<<<<");
    console.log('success', file);
  });

  function errorHandle(err) {
    //console.log("\nIn html:>>>>>>>>>>>>>\n", html, "\n<<<<<<<<<<<<<<<<<");
    console.error("Error:", file, err);
    process.exit(0);
  }
}


/// ...... from web
function walk(path, floor, handleFile) {  
    fs.readdir(path, function(err, files) {  
        if (err) {  
            console.log('read dir error');  
        } else {  
            files.forEach(function(item) {  
                var tmpPath = path + '/' + item;  
                fs.stat(tmpPath, function(err1, stats) {  
                    if (err1) {  
                        console.log('stat error');  
                    } else {  
                        if (stats.isDirectory()) {  
                            walk(tmpPath, floor, handleFile);  
                        } else {  
                            handleFile(tmpPath, floor); 
                        }  
                    }  
                })  
            });  
  
        }  
    });  
}  


// 压力测试
function speedTest() {
  var time = process.hrtime();

  for (var i=0; i<10000; ++i) {
    tool.rendering(strbuf, thecontext, render, function(next, buf, context) {
      // console.log("\nhtml:>>>>>>>>>>>>>\n", buf.toString(), "\n<<<<<<<<<<<<");
      // console.log("context:", context);
    });
  }

  var diff = process.hrtime(time);
  console.log('used', diff[0]*1e3 + diff[1]/1e6, 'ms');
}