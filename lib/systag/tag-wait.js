var tool = require('../tool.js');

//
// ....................................
// time 属性指定等待时间, ms, 
// 默认 100
//
module.exports = function(taginfo) {

	var time = taginfo.attr.time || 300;

  return function(next, buf, context, tag_over) {
    console.log("Test tag | being", taginfo.identify, taginfo.attr);

    if (tag_over) {
      tag_over(function() {
        console.log("Test tag | ending", taginfo.identify);
      });
    }

    setTimeout(next, time);
  };
};
