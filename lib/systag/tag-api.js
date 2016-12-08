var tool = require('../tool.js');
var net  = require('mixer-lib').util.net();
var TIME_OUT = 15 * 1000;

var copyHeaders = ['cookie', 'authorization'];
  
//
// <api url='http://url/?parm' to='api1ret' [type='json/txt'] [method='get/post'] [exp='true']/>
//     请求一个 API, method 指定方法 (默认get), 
//     使用 type 指定的类型解析数据 (默认为 json)
//     并把结果保存在 to 指定的变量中
//
module.exports = function(taginfo, __, errorHandle) {

  if (!taginfo.selfend)
     throw new Error('api Tag must have no BODY');

  var url    = geta('url');
  var save   = geta('to');
  var type   = geta('type', 'json') == 'json' ? 'obj': 'txt';
  var method = geta('method', 'get') == 'get' ? net.get : net.post;
  var exp    = (taginfo.attr.exp == 'true');
  var geturl;

  if (tool.isSystemVar(save)) {
    throw new Error('cannot modify system var "' + to + '"');
  }

  if (exp) {
    exp = tool.expression_complier(url);
    geturl = function(context) {
      return exp.val(context);
    };
  } else {
    geturl = function() {
      return url;
    };
  }


  return function(next, buf, context) {
    var header = {};
    for (var i=copyHeaders.length-1; i>=0; --i) {
      header[ copyHeaders[i] ] = context.getHeader( copyHeaders[i] );
    }
  
    var req = method(geturl(context), {}, function(err, data) {
      if (err) {
        errorHandle(new Error('get `' + url + '` but err:' + err));
        return;
      }
      context[save] = data[type]();
      next();
    }, null, header);

    req.setTimeout(TIME_OUT);
  };


  function geta(name, defaultValue) {
    var r = taginfo.attr[name] || defaultValue;
    if (r == null || r == '') {
      throw new Error('must have ' + name + ' attribute');
    }
    return r;
  }
};
