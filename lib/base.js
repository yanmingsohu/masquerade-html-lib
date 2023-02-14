var path = require('path');


module.exports.html_builder = html_builder;

//
// 创建一个 html 生成器返回渲染器函数, 渲染器原型:
//
// function(next, buf, context)
//    next    -- 渲染器中必须调用 next() 通知下一个渲染器开始渲染, next 之后的代码无效
//    buf     -- 必须有 write 方法的对象, 可以通过 string_buf 创建, 最终输出目标
//    context -- 上下文对象, 由初始渲染器创建
//
// 所有参数都不能 null
//
function html_builder() {
  var ret = {
    html: html,
    and: and,
    tag: tag,
    txt: txt,
    saver: saver
  };
  return ret;

  //
  // 创建一个 html 模板, 并返回渲染器
  // body_render - 渲染器用于渲染 body 中的内容
  // head_render - 渲染器用于渲染 head 中的内容
  //
  function html(body_render, head_render) {

    function setHandleRender(next, buf, context) {
      buf.setHeader &&
          buf.setHeader("Content-Type", "text/html; charset=UTF-8");
      next();
    }

    var root =
      tag('html', and(
        tag('head', head_render),
        tag('body', body_render)
      ));

    return and(setHandleRender, root);
  }

  //
  // 把参数插入渲染器队列中,
  // 返回的渲染器会渲染所有队列中的渲染器
  // and(renderFn, renderFn ... renderFn)
  //
  function and() {
    var s = saver();
    for (var i=0; i < arguments.length;  ++i) {
      if (arguments[i]) s.add(arguments[i]);
    }
    return s;
  }

  //
  // 创建一个渲染器对列, 并允许继续通过 add(renderFn) 插入渲染器
  // 返回的渲染器会渲染队列中所有的渲染器
  //
  // @return {
  //  插入一个渲染器到队列中
  //  add : function(renderFn)
  // }
  //
  function saver() {
    var first = null;

    var ret = function(next, buf, context) {
      first(next, buf, context);
    };

    // 插入渲染器
    ret.add = function(renderFn) {
      if (!first) {
        first = renderFn;
      } else {
        var prv = first;
        first = function(next, buf, context) {
          prv(function() {
            renderFn(next, buf, context);
          }, buf, context);
        }
      }
    }
    return ret;
  }

  //
  // 渲染器之间没有形成调用链, 只是简单的循环
  //
  function easy_saver() {
    var queue = [];

    var ret = function(next, buf, context) {
      var i = -1; _r();

      // _r 充当渲染器的 next 参数
      function _r() {
        if (++i < queue.length-1) {
          queue[i](_r, buf, context);
        } else {
          queue[i](next, buf, context);
        }
      }
    };

    // 插入渲染器
    ret.add = function(renderFn) {
      queue.push(renderFn);
    }
    return ret;
  }

  //
  // 创建一个渲染器, 渲染原始字符串
  //
  function txt(s) {
    return function(next, buf, context) {
      buf.write(s);
      next();
    }
  }

  //
  // 创建一个标签, 返回标签的渲染器
  //
  // tag(name[, content][, attrs])
  //
  // name    -- String: 标签的名字
  // content -- Fuction: 标签体的渲染器
  // attrs   -- {}: 标签属性对象
  //
  function tag(name, a1, a2) {
    var attrs = a2;
    var content = (typeof a1 == 'function' ?  a1 : (attrs=a1, null));

    return function(next, buf, context) {
      buf.write('<');
      buf.write(name);
      for (var n in attrs) {
        buf.write(' ');
        buf.write(n);
        buf.write('="');
        buf.write(attrs[n]);
        buf.write('"');
      }

      if (name[name.length-1] == '/') {
        buf.write('>');
        next();
      } else {
        buf.write('>');
        if (content) content(_over, buf, context);
        else _over();
      }

      function _over() {
        buf.write('</');
        buf.write(name);
        buf.write('>');
        next();
      }
    };
  }
}
