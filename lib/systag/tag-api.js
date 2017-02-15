var tool = require('../tool.js');
var net  = require('mixer-lib').util.net();
var TIME_OUT = 15;

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
  var tout   = parseInt(geta('timeout', TIME_OUT)) * 1000;
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
      var h = context.getHeader( copyHeaders[i] );
      if (h) header[ copyHeaders[i] ] = h;
    }

    var _url = geturl(context);

    var req = method(_url, {}, function(err, data) {
      if (err) {
        context[save] = {
          url     : _url,
          stack   : err.stack,
          message : err.message,
          code    : err.code,
        }
        context[save].prototype = Error;
      } else {
        context[save] = data[type]();
      }
      next();
    }, null, header);

    req.setTimeout(tout, function() {
      req.abort();
    });
  };


  function geta(name, defaultValue) {
    var r = taginfo.attr[name] || defaultValue;
    if (r == null || r == '') {
      throw new Error('must have ' + name + ' attribute');
    }
    return r;
  }
};
