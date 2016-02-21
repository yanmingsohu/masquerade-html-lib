var SyntaxError = require('../error.js').SyntaxError;
var tool        = require('../tool.js');
var pool        = require('../file-pool.js');
var log         = require('logger-lib')('masquerade');
var fs          = require('fs');


// 代码必须在 scriptTimeout 结束前返回
var scriptTimeout = 15 * 1000;

var from_context_argv = [
  'console', 'log', 'setTimeout', 'setInterval',
];

// 要与 callback_argv 一致
var from_callback_argv = [
  'module', 'end', 'write', 'query', 'session', 
  'require', 'val'
];


//
// 包装了 pool.getScript
//
function get_script(code, id, filename) {
  return pool.getScript(code, id, filename, 
                        from_context_argv, 
                        from_callback_argv);
}


//
// 运行一个脚本与并缓存
//
function do_script(script, next, buf, context, errorHandle) {

  function nul() { /* do nothing */ }

  function end() {
    // 防止重复调用
    if (next) {
      next();
      next = null;
    } else {
      throw new Error("cannot call end() repeat");
    }
  }

  function write(o) {
    if (!next) 
        throw new Error('cannot write data after end()');

    if (Buffer.isBuffer(o) || typeof o == 'string') {
      buf.write(o);
    }
    else {
      buf.write(JSON.stringify(o));
    }
  }

  function _require(module_name) {
    // 子脚本改变要影响父脚本
    var file = pool.getPrivatePath('/script', module_name);
    var ref_script = get_script(null, null, file);

    if (!ref_script.module.parent) {
      ref_script.module.parent = script.module.id;
      script.module.children.push(ref_script.module.id);
    }

    return do_script(ref_script, nul, buf, context, errorHandle);
  };

  function val(n, v) {
    if (tool.isSystemVar(n))
        throw new Error("cannot modify system var:" + n);

    var ret = context[n];
    if (v) context[n] = v;
    return ret;
  }

  // --------------------------------------------- End

  try {
    var _module = script.module;
    var sandbox = context.getVmContext();
    var fn      = script.runInContext(sandbox, { timeout: scriptTimeout });

    // 要与 from_callback_argv 一致
    var callback_argv = [
      _module, end, write, context.query, context.session, 
      _require, val
    ];

    if (from_callback_argv.length != callback_argv.length) 
        throw new Error('from_callback_argv NOT EQ callback_argv');

    fn.apply(_module, callback_argv);
    return _module.exports;

  } catch(err) {
    if (next) {
      errorHandle(err);
      next = null;
    } else {
      log.error(err);
    }
  }
}


//
// <script src='/script1.js' [runat='server/client']/>
//
//     如果 runat==server (默认是client)
//     则运行一个服务端脚本, 相对于 /private/script 目录
//     脚本运行在沙箱中, 能力受限
//
module.exports = function(taginfo, userTagFactory, errorHandle, filename) {

  var atserver = (taginfo.attr.runat == 'server');


  if (atserver) {
    // var id  = taginfo.identify;
    var src = taginfo.attr.src;

    // 
    // BODY 和 src 属性不能共存
    //
    if (taginfo.selfend) {
      if (src == null) 
        throw SyntaxError('if no Body must have `src` attribute');

      src = pool.getPrivatePath('/script', src);

      //
      // 服务器脚本, 从 src 指定的文件中取出
      //
      return function(next, buf, context) {
        context.tag_scope.controler.disable_sub();

        var script = get_script(null, null, src);
        do_script(script, next, buf, context, errorHandle);
      }

    } else { // taginfo.selfend == false
      if (src != null)
        throw SyntaxError('if has `src` attribute must have no Body');
      
      if (taginfo.body.length != 1)
        throw Error('Body not has or overage ' + taginfo.body.length);
      
      //
      // 服务器脚本, 从当前页面的 BODY 中取出
      //
      return function(next, buf, context, tag_over) {
        context.tag_scope.controler.disable_sub();

        var code = context.tag_scope.body[0];
        var id   = taginfo.identify;

        var script = get_script(code, id, filename);
        do_script(script, next, buf, context, errorHandle);
      };
    }

  } else { // runat != server

    var attr_exp = tool.parseExp(taginfo.attr_str);
    
    //
    // 浏览器脚本
    //
    return function(next, buf, context, tag_over) {
      buf.write('<script ');
      buf.write( attr_exp.val(context) );
      buf.write('>');

      if (tag_over) {
        tag_over(function() {
          buf.write('</script>');
        });
      } else {
        buf.write('</script>');  
      }

      next();
    };

  } // End else
};

