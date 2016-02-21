var tool = require('../tool.js');

//
// <set to='varname' attr='attrname' value='abc' [exp='false']/>
//     设置 to 指定的变量的 attr 属性值为 value 
//     如果 exp==true (默认false), 则从上下文中取数据
//     修改系统变量会抛出异常
//
module.exports = function(taginfo) {

  if (!taginfo.selfend)
     throw new Error('must have no BODY');

  var to   = geta('to');
  var val  = geta('value');
  var attr = taginfo.attr['attr'];
  var exp  = (taginfo.attr.exp == 'true');
  var getval = null;

  if (exp) {
    exp = tool.expression_complier(val);
    getval = function(context) {
      return exp.val(context);
    };
  } else {
    getval = function() {
      return val;
    };
  }

  if (tool.isSystemVar(to)) {
    throw new Error('cannot modify system var "' + to + '"');
  }

  return function(next, buf, context, tag_over) {
    // console.log('set', to, attr, val)
    if (attr) {
      if (context[to]) {
        context[to][attr] = getval(context);
      } else {
        tool.comment(buf, "set attr, but object not exists: '", to, "'");
      }
    } else {
      context[to] = getval(context);
    }
    next();
  }

  function geta(name) {
    var r = taginfo.attr[name];
    if (r == null || r == '') {
      throw new Error('must have ' + name + ' attribute');
    }
    return r;
  }
};