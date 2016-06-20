var vm   = require('vm');
var path = require('path');
var task = require('mixer-lib').util.lifecycle().newLife;
var log  = require('logger-lib')('masquerade');
var tpl  = require('./template.js');
var bse  = require('./base');

var PRIVATE    = module.exports.PRIVATE = true;
var PUBLIC     = module.exports.PUBLIC  = false;
var COMPLIER   = 'html-complier-render';
var STATIC_TXT = 'static-text-render';

module.exports.createPool = createPool;

//
// 创建模板缓存，加快访问速度
//
// cnf        -- 全局配置
// _fs_lib -- 文件获取器，与 ‘fs’ 库的定义相同, 默认使用 fs
//
// !还需要加入当内存紧张的时候如何清理内存
//
function createPool(cnf, _fs_lib) {

var EXT_NAME       = cnf.extname ? ('.' + cnf.extname) : '.xhtml';
var MAX_FILE_SIZE  = cnf.max_file_size || 1 * 1024 * 1024;
var CACHE_TIME     = cnf.cache_time    || 3 * 60; // 秒
var DEPTH_MAX      = cnf.depth_max     || 10;
var fs             = _fs_lib || require('fs');

// 对编译好的脚本进行缓存
var script_cache = {};
// 全局使用唯一的缓存
var render_cache = {};

var ret = {
  getWatcher        : getWatcher,
  getFile           : getFile,
  getRender         : getRender,
  getRenderFromType : getRenderFromType,
  getPrivatePath    : getPrivatePath,
  getScript         : getScript,
  PRIVATE           : PRIVATE,
  PUBLIC            : PUBLIC,
};

return ret;

//
// 从一段代码或文件中取得脚本, 编译后返回
// 出现错误则抛出异常
//
// 如果 code 为 null 则从 filename 文件中读取脚本, 同时 id 被忽略
// 否则 code 中保存有脚本, filename + id 作为缓存识别
//
// 编译后的脚本运行后会返回一个包装函数, 这个函数的参数名称
// 在 from_callback_argv 中定义
// 这个函数会从沙箱中取得一些变量作为上下文变量, 这些变量的名称
// 在 from_context_argv 中定义
//
// script 对象的属性:
//    filename 关联的文件名
//    module   运行时的 this 对象
//
function getScript(code, id, filename,
    from_context_argv, from_callback_argv)
{
  var scid = code ? (filename +':'+ id) : filename;

  if (script_cache[scid]) {
    log.debug('is cache script', scid);
    return script_cache[scid];
  }

  if (code) {
    getWatcher(filename, del_cache);
    return code_success(code);
  } else {
    var buf = fs.readFileSync(filename);
    getWatcher(filename, del_cache);
    return code_success(buf);
  }

  function code_success(code) {
    var script = compile(code);
    if (script) {
      script_cache[scid] = script;
      script.filename = filename;
      script.module =
        {
          exports   : {},
          filename  : filename,
          id        : scid,
          parent    : null,
          children  : []
        };
    }
    return script;
  }

  function del_cache() {
    log.debug('del cached script', scid);
    delete script_cache[scid];
  }

  //
  // 编译一个脚本, 与运行相关
  //
  function compile(code) {
    var argv1 = from_context_argv  ? from_context_argv.join(',')  : '',
        argv2 = from_callback_argv ? from_callback_argv.join(',') : '';

    var warp = [
      '(function (', argv2, ') {',
        '(function (', argv1, ") {\n",
            code,
        "\n}).call(this, ", argv1, ')',
      '});'
    ];

    code = warp.join('');
    return new vm.Script(code, {filename: filename});
  }
}


//
// 当文件超时或改变, 监听器会被通知
// 返回 null
//
function getWatcher(filename, _change_listener) {
  var timer = task(CACHE_TIME, timeout_buffer);

  var watcher = fs.watch(filename, function(event, fname) {
    if (event == 'change') {
      log.debug("文件改变:", filename);
      clear_buffer();
    } else {
      timer.interrupt();
    }
  });

  function clear_buffer() {
    watcher.close();
    timer.stop();
    _change_listener && _change_listener();
  }

  function timeout_buffer() {
    log.debug("文件缓存超时:", filename);
    clear_buffer();
  }
}


//
// _over: function(err, fileBuffer)
//
function getFile(filename, when_read_over, _change, _encoding) {

  fs.readFile(filename,  { encoding: _encoding },
    function(err, data) {
      if (err)
        return when_read_over(err);

      //
      // 这里创建了 fileBuffer 的数据结构
      //
      var fileBuffer = {
        buf: data,
        changed: false
      };

      fs.stat(filename, function(err, st) {
        fileBuffer.last_modify = lastModTime(err, st);
        getWatcher(filename, clear_buffer);
        when_read_over(null, fileBuffer);
      });

      function clear_buffer() {
        fileBuffer.changed = true;
        fileBuffer.buf = null
        _change && _change();
      }
    }
  );
}


//
// 把文件解析为渲染器返回, 可能返回的是缓存
// 如果扩展名不是服务端脚本, 则返回文本渲染器
// _over: function(err, fileRender)
//
function getRender(filename, tag_factory, _err_cb, _over_cb) {
  if (render_cache[filename]) {
    return _over_cb(render_cache[filename]);
  }

  var isTemplateFile = (path.extname(filename) == EXT_NAME);
  var _encoding = isTemplateFile && cnf.encoding;

  getFile(filename, function(err, fileBuffer) {
    if (err)
        return _err_cb(err);

    try {
      var part = null;

      if (isTemplateFile) {
        part = tpl.html_complier(fileBuffer.buf,
            tag_factory, _err_cb, filename, DEPTH_MAX);
        part.file_type = COMPLIER;
        part.last_modify = -1;
      } else {
        part = bse.html_builder().txt(fileBuffer.buf);
        part.file_type = STATIC_TXT;
        part.last_modify = fileBuffer.last_modify;
      }

      render_cache[filename] = part;
      _over_cb(part);

    } catch(e) {
      _err_cb(e);
    }

  }, function() {
    render_cache[filename] = null;
  }, _encoding);
}


//
// 检查路径有效性, 并返回这个路径
// 失败抛出异常
//
function getPrivatePath(dir, filename, is_public) {
  var base = path.normalize( is_public ? cnf.public : cnf.private );
  if (dir) base = path.join(base, dir);
  var filepath = path.join(base, filename);

  if (filepath.indexOf(base) != 0) {
    throw new Error("Permissions error to read file " + filepath);
  }
  return filepath;
}


//
// 从目录中读取文件并解析为渲染器
// filename -- 原始文件名
// p_state  -- 是否从私有目录来
// dir      -- 子目录, 如果 p_static==false, 则忽略这个参数
// _over_cb -- Function(render) 返回渲染器,
//             render.file_type 渲染器类型,
//             render.last_modify 最后修改时间, -1 则无效
//
function getRenderFromType(dir, filename, p_state, tag_factory, _err_cb, _over_cb) {
  try {
    var is_public = (p_state == PUBLIC);
    var fn = getPrivatePath(is_public ? null : dir, filename, is_public);
    var isTemplateFile = (path.extname(filename) == EXT_NAME);

    fs.stat(fn, function(err, stats) {
      if (err) return _err_cb(err);

      if (stats.size > MAX_FILE_SIZE && isTemplateFile == false) {
        getBigStaticFileRender(fn, _err_cb, _over_cb, stats.size);
      } else {
        getRender(fn, tag_factory, _err_cb, _over_cb);
      }
    });

  } catch(err) {
    _err_cb(err);
  }
}


//
// 大文件不会缓冲, 使用这个方法创建渲染器
// 渲染器只能使用一次, 之后丢弃
//
function getBigStaticFileRender(filename, _err_cb, _over_cb, filesize) {

  fs.open(filename, 'r', function(err, fd) {
    if (err) return _err_cb(err);

    var render = function(next, buf, context) {
      var reader = fs.createReadStream(null, {
        fd: fd, autoClose: true
      });

      reader.pipe(buf, { end: false });

      reader.on('end', function() {
        next();
      });
    };

    fs.fstat(fd, function(err, st) {
      render.file_type = "big-nocache-file";
      render.last_modify = lastModTime(err, st);
      _over_cb(render);
    });
  });
}


// 毫秒部分为 0
function lastModTime(err, st) {
  if (err) return -1;
  var r = st.mtime.getTime();
  r = parseInt(r / 1000);
  return r * 1000;
}

// createPool --END--
}
