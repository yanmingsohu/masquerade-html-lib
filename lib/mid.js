var systag = require('./install-systag.js');
var deftag = require('./install-def-tag.js');
var pooll  = require('./file-pool.js');
var tool   = require('./tool.js');
var conf   = require('./conf.js');
var path   = require('path');
var log    = require('logger-lib')('masquerade');
var mime   = require('mime');
var vm     = require('vm');
var url    = require('url');
var mix    = require('mixer-lib');
var fs     = require('fs');
var util   = require('util') ;
var qs     = require('querystring');


var __id = 0;


//
// baseurl     -- url 起始路径
// _config:
//    public   -- 公共访问目录, web 资源根目录, 绝对目录
//    private  -- 私有目录, 脚本等文件目录, 绝对目录
// _debug      -- 调试模式在 html 页面上打印错误栈
// _fs_lib     -- 文件获取器，与 ‘fs’ 库的定义相同, 默认使用 fs,
//    自定义 fs-lib 需要实现的方法, 定义与 fs 中的相同
//    readFileSync watch readFile
//    stat open createReadStream fstat
//
// 待实现: session,
//
module.exports = function(baseurl, _config, _debug, _fs_lib) {
  var config = _config ||  conf.load().masquerade;
  var is_dev = _debug  || (conf.load().env == 'development');
  var EXT    = '.' + config.extname;
  var pool   = pooll.createPool(config);

  //
  // 一个应用范围的沙箱, 允许多个脚本之间的数据通讯
  // 延迟创造这个对象, 提升效率
  // ! 随请求而创建沙箱, 会导致内存泄漏
  //
  var sandbox = null;

  //
  // 一旦静态文件出错, 这个救急用
  //
  // var staticfile = mix.util.mid().ex_static(config.public, baseurl, true);

  //
  // 标签工厂, 用于创建各种服务端标签
  //
  var tag_factory = {};

  //
  // 默认页使用 ',' 分割
  //
  var default_page = config.default_page;
  if (!default_page) default_page = 'index.html';
  default_page = default_page.split(',');

  //
  // baseurl 始终不以 '/' 结尾, 或本身是 ''
  //
  baseurl = last_not_div(baseurl);


  systemVar();
  systag(tag_factory);
  deftag(pool, tag_factory, EXT);

  var ret = _mid_process;
  ret.add_plugin = add_plugin;
  return ret;


  function _mid_process(res, rep, next) {
    // 后面用到的属性, 而 native 并未提供
    var query   = url.parse(res.url, true);
    res.query   = query.query;
    res.path    = query.pathname;
    res.header  = function(n) {
      if (n) return res.headers[n.toLowerCase()];
    }

    if (!next) {
      next = log.debug;
    }

    if (res.path.indexOf(baseurl) != 0) {
      return next();
    }

    rep.on('error', function(err) {
      log.error('Response', err);
    });

    var stime = process.hrtime();
    var _url = res.path;

    // 一旦静态文件出错, 这个救急用 2
    // if (path.extname(res.url) != EXT) {
    //   return staticfile(res, rep, next);
    // }

    find_url_page(res.path, function(err, __url, isJump) {
      if (err) return next(err);
      try {
        if (isJump) {
          redirect(join_url(baseurl, __url));
          return;
        }

        checkRequest(function() {
          pool.getRenderFromType(null, __url,
              pool.PUBLIC, tag_factory, errorHandle, successHandle);
        });

      } catch(err) {
        errorHandle(err);
      }
    });


    function successHandle(render) {
      // console.log(res.headers)
      rep.setHeader("Content-Type", mime.lookup(_url));

      if (lastModifyHandle(render)) {
        return;
      }

      var context = createRequestContext(res, rep);
      render.setErrorHandle && render.setErrorHandle(errorHandle);
      render(overRender, rep, context);
    }


    function lastModifyHandle(render) {
      if (res.header('pragma') == 'no-cache')
        return false;

      if (res.header('cache-control') == 'no-cache')
        return false;

      var if_mod_sin = res.header('If-Modified-Since');
      if (if_mod_sin) {
        if_mod_sin = new Date( if_mod_sin ).getTime();

        if (render.last_modify <= if_mod_sin) {
          rep.statusCode = 304;
          overRender('[304] Not modify');
          return true;
        }
      }

      try {
        rep.setHeader('Last-Modified',
            new Date(render.last_modify).toGMTString() );
      } catch(e) {
        log.error(e);
      }

      return false;
    }


    function errorHandle(err) {
      log.error('On Error', res.url, err);
      // is_dev=false;
      if (!rep.finished) {
        try {
          rep.statusCode = 404;
          rep.write('<pre>');
          rep.write('cannot get ');
          rep.write(res.url);
          rep.write("\n\n");

          if (is_dev) {
            rep.write(err.stack);
          } else if (err.why) {
            rep.write(err.why);
            rep.write('at line ');
            rep.write(err.line + '');
            rep.write(', column ');
            rep.write(err.col + '');
          } else {
            rep.write(err.message);
          }

          rep.write('</pre>');
        } catch(eee) {
          log.error(eee);
        }
      }
      overRender();
    }


    function overRender(debug_msg) {
      rep.end();
      var diff = process.hrtime(stime);
      var use  = diff[0] * 1e3 + diff[1] / 1e6;
      log.debug('Request', _url, debug_msg||'', 'use', use, 'ms');
    }


    function redirect(where) {
      rep.statusCode = 302;
      rep.setHeader('Location', where);
      rep.end();
    }


    function checkRequest(next) {
      if (res.header('Range')) {
        // log.error("cannot support Range HTTP field");
        rep.setHeader('Accept-Ranges', 'none');
      }

      if (res.header('content-type') == 'application/x-www-form-urlencoded') {
        return parseBody(res, next);
      }
      return next();
    }
  }


  // 在系统初始化前, 先要注重变量名
  function systemVar() {
    tool.addSystemVar('getHeader');
    tool.addSystemVar('setHeader');
    tool.addSystemVar('query');
    tool.addSystemVar('nextId');
    tool.addSystemVar('getVmContext');
    tool.addSystemVar('baseurl');
    tool.addSystemVar('session');
  }


  function createRequestContext(res, rep) {
    var context = {
      getHeader     : function(name) { return res.header(name) },
      setHeader     : function(n, v) { rep.setHeader(n, v) },
      nextId        : function() { return ++__id; },
      query         : res.query,
      getVmContext  : getVmContext,
      baseurl       : baseurl,
      log           : log.info,
      filepool      : pool,
      config        : config.runtime_cfg,
    };
    return context;
  }


  // 这个方法用于返回当前上下文给 vm 使用
  function getVmContext() {
    if (!sandbox) {
      sandbox = vm.createContext();
      init_sandbox_fn(sandbox);
    }
    return sandbox;
  }


  function init_sandbox_fn(_sandbox) {
    // 往 sandbox 传递数据在请求上下文中始终不变,
    // 需要绑定 context 不能放在这里
    _sandbox.log         = log;
    _sandbox.console     = log;
    _sandbox.setTimeout  = setTimeout;
    _sandbox.setInterval = setInterval;
  }


  //
  // 判断路径是否是目录, 自动与配置中指定的默认页做跳转
  // 返回的 url 不含有 baseurl 路径
  //
  function find_url_page(_org_url, rcb) {
    _url = _org_url.substr(baseurl.length);
    var i      = -1;
    var r_url  = decodeURI(_url);
    var isJump = false;

    _next();


    function _next() {
      var file = path.join(config.public, r_url);
      fs.stat(file, function(err, stats) {
        if (err) {
          _next_def(_next);
        } else {
          if (stats.isFile()) {
            rcb(null, r_url, isJump);
          } else if (stats.isDirectory()) {
            isJump = true;
            _next_def(_next);
          } else  {
            _next_def(_next);
          }
        }
      });
    }


    function _next_def(__n) {
      if (++i < default_page.length) {
        if (_url) {
          r_url = join_url(_url, default_page[i]);
        } else {
          r_url = default_page[i];
        }
        __n();
      } else {
        rcb('not found ' + _org_url);
      }
    }
  }


  function add_plugin(pinfo) {
    if (!pinfo.name)
      throw new Error('invalid plugin name');

    if (!pinfo.func)
      throw new Error('invalid plugin render function');

    if (tag_factory[pinfo.name])
      throw new Error(pinfo.name + ' plugin is exist');

    tag_factory[pinfo.name] = pinfo.func;
  }
};


//
// 连接 url = a+b
//
function join_url(a, b) {
  var bf = b[0] == '/';
  var al = a[a.length-1] == '/';

  if (bf) {
    if (al) {
      return a + b.substr(1);
    } else {
      return a + b;
    }
  } else {
    if (al) {
      return a + b;
    } else {
      return a + '/' + b;
    }
  }
}


//
// 保证 url 不以 '/' 结尾
//
function last_not_div(u) {
  if (!u)
    return '';
  if (u[ u.length-1 ] == '/')
    return u.substring(0, u.length-1);
  return u;
}


//
// 保证 url 是以 '/' 结尾
//
function last_div(u) {
  if (!u)
    return '/';
  if (u[ u.length-1 ] == '/')
    return u;
  return u + '/';
}


function parseBody(res, next) {
  var bufs = [];

  res.on('data', function(b) {
    bufs.push(b);
  });

  res.on('end', function() {
    var post = Buffer.concat(bufs).toString();
    var body = qs.parse(post);
    var query = res.query;

    for (var n in body) {
      if (query[n]) {
        if (util.isArray(query[n])) {
          query[n].push(body[n]);
        } else {
          query[n] = [ query[n], body[n] ];
        }
      } else {
        query[n] = body[n];
      }
    }

    res.query = query;
    next();
  });
}


process.on('uncaughtException', function(err) {
  console.error('Caught exception: ', err.stack);
});
