var tool = require('../tool.js');
var net  = require('mixer-lib').util.net();
var clib = require('configuration-lib');
var TIME_OUT = 15 * 1000;

var copyHeaders = ['cookie', 'authorization'];

//
// http://172.16.140.129:8088/ds/api/roles?rbac=rbac&app=auth&mod=rbac&org=a297dfacd7a84eab9656675f61750078&openid=jilianzhi&s=d
//
// <auth [to='auth'] />
//     获取页面权限数据，并把结果保存在 to 指定的变量中，默认变量名为 auth
//
module.exports = function(taginfo, __, errorHandle) {

  if (!taginfo.selfend)
     throw new Error('api Tag must have no BODY');

  var pageid = geta('page');
  var save   = geta('to', 'auth');
  var url;

  if (tool.isSystemVar(pageid) || tool.isSystemVar(save)) {
    throw new Error('cannot modify system var "' + to + '"');
  }

  try {
    var conf = clib.load();
    url = 'http://' + conf.ui_ide.host + ':' + conf.ui_ide.proxyPort
      + '/ds/api/uiauth?app=ZYAPP_LOGIN&mod=ZYMODULE_LOGIN'
      + '&pageid=' + pageid; //context['org'] +
      
  } catch(e) {
    // 出错则打印错误
    return function(next, buf, context) {
      buf.write(e.message);
      next();
    };
  }

  return function(next, buf, context) {
    var header = {};
    for (var i=copyHeaders.length-1; i>=0; --i) {
			var hval = context.getHeader( copyHeaders[i] );
			if (hval) {
				header[ copyHeaders[i] ] = hval;
			}
    }
		
		var t_url = url + '&org=' + context.query.org;

    var req = net.get(t_url, {}, function(err, data) {
      if (err) {
        errorHandle(new Error('get `' + t_url + '` but err:' + err));
        return;
      }
      context[save] = data['txt']();//['result']
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
