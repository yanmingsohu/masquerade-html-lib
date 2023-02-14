var tool  = require('./tool.js');
var path  = require('path');
var log   = require('logger-lib')('masquerade');

var SAVE_KEY = '_-_PIT0_BODY';

//
// 加载用户 HTML 标签到 tagFactory 中
// EXT - 带有 . 开始的扩展名
//
module.exports = function(pool, tagFactory, EXT, fs) {
  var root = pool.getPrivatePath('/tag', '/');
  var hfs  = require('./hfs.js');

  findfile(root);

  hfs.watch(fs, root, function(err, watcher) {
    if (!err) {
      watcher.on('addfile', function(f) {
        var ns = path.dirname( f.substr(root.length) ).replace(/\\|\//g, '-');
        createTag(f, ns);
      });

      watcher.on('removefile', function(f) {
        var tagname = path.basename(f, EXT);
        log.log('remove tag [', tagname, ']', f)
        delete tagFactory[tagname];
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
    hfs.eachDir(fs, _dir, false, function(fname, state) {
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
      log.warn("不能作为自定义标签模板:", file, EXT);
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
    tagFactory[tagname] = TagProxy(file, tagFactory, pool);
  }


  //
  // 延时渲染模板
  //
  function TagProxy(tagfile, tagFactory, pool) {

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
        
        var pit_call = null;

        //
        // pit 渲染顺序: 
        // 1. renderPit 保存到上下文
        // 2. <pit> 标签调用保存的 renderPit 方法注册自身渲染函数
        // 3. renderPit 调用
        // 4. tag_over 的回调函数被调用
        // 5. renderTag 的回调函数被调用
        //
        if (tag_over) {
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
        } else {
          renderTag(next);
        }

        function renderPit(_over) {
          tag_scope.controler.enable_sub();
          pit_call = _over;
          next();
        }

        function renderTag(_render_over) {
          pool.getRender(tagfile, userTagFactory, errorHandle, function(render) {
            render(_render_over, buf, context);
          });
        }
      };

    };
  }

}
