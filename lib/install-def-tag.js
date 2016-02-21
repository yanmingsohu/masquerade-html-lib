var pool  = require('./file-pool.js');
var tool  = require('./tool.js');
var hfs   = require('./hfs.js');
var conf  = require('./conf.js');
var fs    = require('fs');
var path  = require('path');
var log   = require('logger-lib')('masquerade');

var SAVE_KEY = '_-_PIT0_BODY';

//
// 加载用户 HTML 标签到 tagFactory 中
//
module.exports = function(tagFactory) {

  var EXT = '.' + conf.load().masquerade.extname;
  var root = pool.getPrivatePath('/tag', '/');

  findfile(root);

  hfs.watch(root, function(err, watcher) {
    if (!err) {
      watcher.on('addfile', function(f) {
        var ns = path.dirname( f.substr(root.length) ).replace(/\\|\//g, '-');
        createTag(f, ns);
      });
    } else {
      log.error(err);
    }
  });

  // 读取目录构建标签文件代理渲染函数
  // 当代理被调用的时候, 加载渲染器
  // 与系统标签的冲突
  // 与 HTML 客户端标签的冲突

  function findfile(_dir, namespace) {
    hfs.eachDir(_dir, false, function(fname, state) {
      if (state.isDirectory()) {
        var ns = path.basename(fname);
        if (namespace) {
          ns = namespace + '-' + ns;
        }
        findfile(fname, ns);
        return;
      }

      createTag(fname, namespace);
    });
  }

  function createTag(file, namespace) {
    if (path.extname(file) != EXT) {
      log.warn("不能作为自定义标签模板:", file);
      return;
    }

    var tagname = path.basename(file, EXT);
    if (namespace && namespace != '.') {
      tagname = namespace + ":" + tagname;
    }

    if (tagFactory[tagname]) {
      log.warn('标签名称已存在, 禁止覆盖:', tagname);
      return;
    }

    log.log('create tag [', tagname, ']', file)
    tagFactory[tagname] = TagProxy(file, tagFactory);
  }
};

//
// 延时渲染模板
//
function TagProxy(tagfile, tagFactory) {

  // 这是渲染器工厂
  return function(taginfo, userTagFactory, errorHandle, filename) {

    // 这是渲染器
    return function(next, buf, context, tag_over) {
      for (var n in taginfo.attr) {
        if (tool.isSystemVar(n)) {
          throw new Error('cannot modify system var "' + n + '"');
        }
        context[n] = taginfo.attr[n];
      }

      if (tag_over) {
        var pit_call = null;
        var tag_scope = context.tag_scope;
        // tag_scope.controler.disable_sub();
        context[SAVE_KEY] = renderPit;


        tag_over(function() {
          tag_scope.controler.disable_sub();
          if (pit_call) {
            pit_call();
            pit_call = null;
            return 'stop';
          }
        });

        renderTag(function() {
          delete context[SAVE_KEY];
          next();
        });

        function renderPit(_over) {
          tag_scope.controler.enable_sub();
          pit_call = _over;
          next();
        }
      } else {
        renderTag(next);
      }

      function renderTag(_render_over) {
        pool.getRender(tagfile, userTagFactory, errorHandle, function(render) {
          render(_render_over, buf, context);
        });
      }
    };

  };
}


// 遍历目录,
// eachChild - 是否遍历子目录
// cb - 每个文件/目录的回调函数 function(path, state)
function eachDir(dir, eachChild, cb) {
  var dirs = fs.readdirSync(dir);

  for (var i in dirs) {
    // 限制搜索文件的数量
    //if (max-- < 0) throw "is over.";

    var dname = dir + "/" + dirs[i];

    try {
      var st = fs.statSync(dname);
      cb(dname, st);

      if (eachChild && st.isDirectory()) {
        eachDir(dname, eachChild, cb);
      }
    } catch(E) {
      console.log("err", dname, E);
    }
  }
}
