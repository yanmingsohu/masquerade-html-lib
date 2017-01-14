var tool = require('../tool.js');
var path = require('path');

//
// <include [private="false"] src="/page/a.html"/>
//
//  包含一个页面, 默认从 public 目录, 如果 private='true' 则从
//  private/include 目录读取
//  不能有标签体
//
module.exports = function(taginfo, userTagFactory, errorHandle, fname) {

  if (!taginfo.selfend)
     throw new Error('must no BODY');
  var exp = (taginfo.attr.exp == 'true');

  var src = taginfo.attr['src'];
  if (!src)
    throw Error("must have 'src' attribute");

  var private = (taginfo.attr['private'] == 'true');
  var dir = path.dirname(fname);
  var getsrc;
  var rechange_src;

  function fixsrc(_src, fixdir) {
    var tsrc = path.normalize(_src);
    var tfix = path.normalize(fixdir);
    if (tsrc.indexOf(tfix) >= 0) {
      _src = tsrc.substr(tfix.length);
    }
    return _src;
  }

  if (exp) {
    exp = tool.expression_complier(src, true);
    getsrc = function(context) {
      var target = exp.val(context);
      if (private) {
        return target;
      } else {
        target = path.join(dir, target);
        return fixsrc(target, context.publicdir);
      }
    };
  } else {
    // publicdir 只在　context 中提供, 所以要等到渲染时修正路径
    rechange_src = (!private) && (!path.isAbsolute(src));
    getsrc = function(context) {
      if (rechange_src) {
        src = path.join(dir, src);
        src = fixsrc(src, context.publicdir);
        rechange_src = false;
      }
      return src;
    };
  }


  return function(next, buf, context) {
    context.filepool.getRenderFromType('/include',
        getsrc(context), private, userTagFactory, errorHandle, when_success);

    function when_success(includeRender) {
      includeRender(next, buf, context);
    }
  };
};
