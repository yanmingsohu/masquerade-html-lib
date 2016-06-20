module.exports = {
  create : create
};


function create() {
  var fs = require('fs');

  var ret = {
    readScriptFile  : readScriptFile,
    readFile        : fs.readFile,
    watchChange     : watchChange,
    lastModify      : lastModify,
    filesize        : filesize,
    openFileStream  : openFileStream,
  };

  return ret;

  //
  // 返回 js 脚本文件, 改方法必须同步执行
  //
  function readScriptFile(filename) {
    return fs.readFileSync(filename);
  }

  //
  // 当文件内容改变时回调, 通过返回的句柄 .close() 关闭监听器
  // rcb -- Function(filename)
  // return -- { close:Function() }
  //
  function watchChange(filename, rcb) {
    return fs.watch(filename, function(event, fname) {
      if (event == 'change') {
        rcb(fname);
      }
    });
  }

  //
  // 返回文件最后修改时间, 单位毫秒, 整数类型
  // rcb -- Function(err, mtime)
  //
  function lastModify(filename, rcb) {
    stat(filename, function(err, stat) {
      if (err) return rcb(err);
      rcb(null, stat.size);
    });
  }

  //
  // 返回文件长度, 单位字节, 整数类型
  // rcb -- Function(err, size)
  //
  function filesize(filename, rcb) {
    stat(filename, function(err, stat) {
      if (err) return rcb(err);
      rcb(null, stat.mtime.getTime());
    });
  }

  //
  // 打开文件输入流, 用于打开大文件
  // rcb -- Function(err, instream)
  //
  function openFileStream(filename, rcb) {
    try {
      var instream = fs.createReadStream(filename, {
        autoClose: true
      });
      rcb(null, instream);
    } catch(err) {
      rcb(err);
    }
  }

  function stat(filename, rcb) {
    fs.stat(filename, rcb);
  }
}
