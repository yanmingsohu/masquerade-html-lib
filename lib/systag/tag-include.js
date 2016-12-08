var tool = require('../tool.js');

//
// <include [private="false"] src="/page/a.html"/>
//
//  包含一个页面, 默认从 public 目录, 如果 private='true' 则从
//  private/include 目录读取
//  不能有标签体
//
module.exports = function(taginfo, userTagFactory, errorHandle) {

  if (!taginfo.selfend)
     throw new Error('must no BODY');
  var exp = (taginfo.attr.exp == 'true');
  
  var src = taginfo.attr['src'];
  if (!src)
    throw Error("must have 'src' attribute");

  var private = (taginfo.attr['private'] == 'true');
  var getsrc;
  
  if (exp) {
    exp = tool.expression_complier(src, true);
    getsrc = function(context) {
      return exp.val(context);
    };
  } else {
    getsrc = function() {
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
