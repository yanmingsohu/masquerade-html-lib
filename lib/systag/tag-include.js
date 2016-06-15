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

  var src = taginfo.attr['src'];
  if (!src)
    throw Error("must have 'src' attribute");

  var private = (taginfo.attr['private'] == 'true');


  return function(next, buf, context) {
    context.filepool.getRenderFromType('/include', 
        src, private, userTagFactory, errorHandle, when_success);

    function when_success(includeRender) {
      includeRender(next, buf, context);
    }
  };
};
