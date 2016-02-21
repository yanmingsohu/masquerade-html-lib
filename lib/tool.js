var vm = require('vm');
var SyntaxError = require('./error.js').SyntaxError;


var SYSTEM_VAR = {};
var express_timeout = 1000;
var express_sandbox = vm.createContext();
var __id = 1;

module.exports.string_buf          = string_buf;
module.exports.rendering           = rendering;
module.exports.expression_complier = expression_complier;
module.exports.isSystemVar         = isSystemVar;
module.exports.addSystemVar        = addSystemVar;
module.exports.forEachSystemVar    = forEachSystemVar;
module.exports.comment             = comment;
module.exports.nextId              = nextId;
module.exports.parseExp            = parseExp;


//
// Buffer 包装器, 实现可自动增长的 Buffer
//
function string_buf(len) {
  var grow_coefficient  = 0.75;
      len = len || 50;
  var buf = new Buffer(len);
  var p = 0;

  var ret = {
    write: function(s) {
      if (!s) return;
      var x = p + s.length;

      if (x >= len) {
        var nbuf = new Buffer(x + x * grow_coefficient);
        buf.copy(nbuf);
        len = nbuf.length;
        buf = nbuf;
      }

      buf.write(s, p); 
      this.length = p = x;
    },

    toString: function(encoding, start, end) {
      if (!start) start = 0;
      if (!end) end = p;
      return buf.toString(encoding, start, end);
    },

    length: 0
  };

  return ret;
}


//
// 解析表达式 exp = 'a.b.c'
// must_easy_exp -- true 强制解析为简单表达式
// return context.a.b.c
//
// var ctx = { a: { b:'hello' } };
// var ec = expression_complier('a.b');
// ec.val(ctx) == 'hello'
//
// 简单表达式支持赋值
// ec.val(ctx, 10) == 10, b == 10
//
// new vm.Script(exp, opt); 的效率太低 相差10倍
// runInContext 比 runInNewContext 快 10 倍
//
function expression_complier(exp, must_easy_exp) {
  var ret   = {};
  var attrs = [];
  var adv   = {'[':1, ']':1, '(':1, ')':1, '+':1, '-':1, '*':1, '/':1, '=':1};

  if (parse()) {
    ret.val = function(context, _set_val) {
      var ret = context;
      var i = -1;

      while (++i < attrs.length-1) {
        ret = ret[attrs[i]];
      }

      if (i < attrs.length) {
        if (_set_val) ret[attrs[i]] = _set_val;
        ret = ret[attrs[i]];
      }

      if (i >=0) { return ret;  }
      else       { return null; }
    };

  } else {

    var script = new vm.Script(exp, {filename: 'bird-express'});

    ret.val = function(context) {
      for (var n in context) {
        express_sandbox[n] = context[n];
      }
      return script.runInContext(express_sandbox, 
              { timeout: express_timeout });
    };
  }

  return ret;

  // 不允许赋值
  function safe() {
    var i = 0, ch, j = 0;
    var name = [];

    while (i < exp.length) {
      if (exp[i] == '=') {
        if (exp[i+1] != '=') {
          ch = exp[i-1];
          if (ch != '>' && ch != '<') {
            throw SyntaxError(
              "expression not allow Assignment operator: `" 
              + exp + '`');
          }
        } else {
          ++i;
        }
      }
      ++i;
    }
  }

  function parse() {
    var i = 0, ch, f = 1, sp = 0;
    var name = [];

    while (i < exp.length) {
      ch = exp[i];

      if (adv[ch] == 1 && (!must_easy_exp)) {
        safe();
        return false;
      }
      else if (ch == ' ' || ch == '\t' || ch == '\n') {
        if (f == 2) {
          ++sp;
        }
        // skip
      }
      else if (f == 1) {
        f = 2;
        continue;
      }
      else if (f == 2) {
        if (ch == '.') {
          f = 1;
          attrs.push(name.join(''));
          name = [];
          sp = 0;
        } else {
          if (sp) {
            throw SyntaxError("expression not allow: '" + exp + "'");
          }
          name.push(ch);
        }
      }
      ++i;
    }

    if (name.length > 0)
      attrs.push(name.join(''));
    return true;
  }
}


//
// 渲染多个渲染器, 到 Buffer 中
// context 是应用上下文
// rendering(Buffer, context, renderFn, renderFn ...)
//
function rendering(buffer, context) {
  var argv = arguments;
  var i = 2 -1;
  _r();

  function _r() {
    if (++i < argv.length) {
      argv[i](_r, buffer, context);
    } else {
      console.log('Rendering over.');
    }
  }
}


//
// context 中有一些变量是不允许用户操作的
// 此时, 返回 true
//
function isSystemVar(name) {
  return SYSTEM_VAR[name] != null;
}

function addSystemVar(name) {
  SYSTEM_VAR[name] = true;
}

function forEachSystemVar(every_name) {
  for (var name in SYSTEM_VAR) {
    every_name(name);
  }
}

//
// 输出一段 html 注释
//
function comment(buf, msg) {
  if (!buf.write) {
    throw new Error('First Argument must Buffer not ' + buf);
  }

  buf.write('<!--');
  if (arguments.length > 2) {
    for (var i = 1; i < arguments.length; ++i) {
      buf.write(arguments[i]);
    }
  } else {
    buf.write(msg); 
  }
  
  buf.write('-->');
}


function nextId() {
  return __id++;
}


//
// 解析一个字符串, 并解析器中的表达式, 返回一个对象
// 使用其中的 val(context) 方法取得表达式的结果
//
function parseExp(expstr) {
  var i = 0, ch, f = 1, cc = 0;
  var b = 0;
  var valarr = [];

  function str_render(a, b) {
    var _sub = expstr.substring(a, b);
    return {
      val: function() {
        return _sub;
      }
    };
  }

  while (i < expstr.length) {
    ch = expstr[i];

    if (f == 1) { // 普通字符阶段
      if (ch == '#') {
        f = 2;
        continue;
      }
    }
    else if (f == 2) { // 检测表达式开始
      if (ch == '#') {
        ++cc;
        if (cc == 3) {
          var strr = str_render(b, i-2);
          valarr.push(strr);
          f = 3;
          b = i+1;
        }
      }
      else {
        f = 1;
      }
    }
    else if (f == 3) { // 进入表达式
      if (ch == '#') {
        f = 4;
        var expr = expression_complier(expstr.substring(b, i));
        valarr.push(expr);
        continue;
      }
    }
    else if (f == 4) { // 退出表达式, 必须连续三个 #
      if (ch == '#') {
        --cc;
        if (cc == 0) {
          f = 1;
          b = i+1;
        }
      } else {
        throw SyntaxError("must ### to end express");
      }
    }

    ++i;
  }

  if (b < i) {
    var strr = str_render(b, expstr.length);
    valarr.push(strr);
  }

  // 返回的对象内容与 expression_complier() 返回的相同
  return {
    val : function(context) {
      var _ret = [], 
          _len = valarr.length;

      for (var i = 0; i < _len; ++i) {
        var v = valarr[i].val(context);
        if (typeof v != 'string') {
          v = JSON.stringify(v);
        }
        _ret.push( v );
      }

      return _ret.join('');
    }
  };
}