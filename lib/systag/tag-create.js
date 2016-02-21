var tool = require('../tool.js');

//
// <create to='varname' a-s='string' b-e='express' c-n='9' />
//     创建一个对象 Object, 放入上下文的 to 指定的变量中
//     参数的说明: 由 nnn-T 形成的参数列表 nnn 指定一个属性, T 指定数据类型
//     T 的有效类型: 's': 字符串, 'e':表达式, 'i':整数, 'f':浮点数
//     如果不指定类型, 默认是字符串; 如果 to 指定的变量以及存在则什么都不做
//
module.exports = function(taginfo) {

  if (!taginfo.selfend)
     throw new Error('must have no BODY');

  var to = taginfo.attr.to;
  if (to == null || to == '') {
    throw new Error('must have "to" attribute');
  }

  //
  // 设置对象属性的方法数组, 方法原型 function(target, context)
  // 渲染器调用每一个方法来设置 target 的属性
  //
  var setter = [];

  function pushFn(n, v, ex) {
    if (ex) {
      setter.push(function(obj, context) {
        obj[n] = ex.val(context);
      });
    } else {
      setter.push(function(obj) {
        obj[n] = v;
      });
    }
  }

  //
  // 在编译器完成类型的判别, 提升运行期效率
  //
  for (var attr in taginfo.attr) {
    if (attr == 'to') continue;

    var fi = attr.indexOf('-');
    var n  = attr, t;
    var v  = taginfo.attr[attr];

    if (fi>0 < fi<attr.length-1) {
      n = attr.substring(0, fi);
      t = attr.substr(fi + 1);
    }

    switch(t) {
      case 'e':
        var ex = tool.expression_complier(v);
        pushFn(n, null, ex);
        break;

      case 'f':
        pushFn(n, parseFloat(v));
        break;

      case 'i':
        pushFn(n, parseInt(v));
        break;

      case 's':
      default:
        pushFn(n, v);
        break;
    }
  }

  return function(next, buf, context, tag_over) {
    if (context[to]) {
      tool.comment(buf, 'create Object but exists `', to, '`');
      //throw new Error();
      return next();
    }

    var obj = context[to] = {};

    setter.forEach(function(_set) {
      _set(obj, context);
    });

    next();
  }
};