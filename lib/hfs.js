var Event = require("events");
var plib  = require('path');

if (Event.EventEmitter)
  Event = Event.EventEmitter;

module.exports = {
  watch   : watch,
  eachDir : eachDir,
};


//
// path -- 要监视的根目录
// rcb  -- Function(err, watcher)
//    watcher.on(EVENTNAME, Function(filename))
//
// Event:
//    addfile, adddir, changefile, changedir
//
//
function watch(fs, _path, rcb) {
//  try {
//    var hfs = require('hexo-fs');
//    hfs.watch(path, {recursive:true, persistent:true}, rcb);
//  } catch(err) {
//    console.log(err.message, ', Use native fs lib to watch.');
//  }

  var e = new Event();

  _watch_dir(_path);

  eachDir(fs, _path, true, function(fname, st) {
    if (st.isDirectory()) {
      _watch_dir(fname);
    }
  });

  e.close = function() {
    e.emit('close');
    e.removeAllListeners();
  };

  rcb(null, e);


  function _watch_dir(_dir) {
    var w = fs.watch(_dir);

    w.on('change', function(ename, filename) {
      if (!filename) return;
      filename = plib.join(_dir, filename);

      fs.stat(filename, function(err, st) {
        if (err) {
          if (err.code == 'ENOENT') {
            return e.emit('removefile', filename);
          }
          return console.log('hfs.js _watch_dir()', filename, err);
        }
        if (!st.birthtime) {
          // 兼容 node 0.10
          var a = st.atime.getTime();
          var b = st.mtime.getTime();
          var c = st.ctime.getTime();
          if (a==b && b==c) {
            ename = 'add';
          } else {
            ename = 'change';
          }
        } else if (st.ctime.getTime() == st.birthtime.getTime()) {
          ename = 'add';
        } else {
          ename = 'change';
        }

        if (st.isDirectory()) {
          ename += 'dir';
          _watch_dir(filename);
        } else {
          ename += 'file';
        }
        // console.log('+++ hfs.js', ename, filename, st);
        e.emit(ename, filename);
      });
    });

    w.on('error', function(e) {
      e.emit('error', e);
    });

    e.on('close', function() {
      w.close();
    });
  }
}

//
// 遍历目录,
// eachChild - 是否遍历子目录
// cb - 每个文件/目录的回调函数 function(path, state)
//
function eachDir(fs, dir, eachChild, cb) {
  var i = -1;

  fs.readdir(dir, function(err, dirs) {
    if (err) throw err;
    
    dirs.forEach(function(name) {
    // for (var i=0, e=dirs.length; i<e; ++i) {
      // 限制搜索文件的数量
      //if (max-- < 0) throw "is over.";

      var dname = dir + "/" + name;

      fs.stat(dname, function(err, st) {
        if (err) return console.log("err", dname, err);
        cb(dname, st);

        if (eachChild && st.isDirectory()) {
          eachDir(fs, dname, eachChild, cb);
        }
      });
    });
  });
}
