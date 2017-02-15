var tool = require('../tool.js');
var IF_ELSE_KEY = '__if_else_var';

//
// <else></else>
//
// 于 if 标签配对使用
//
module.exports = function(taginfo) {

	if (taginfo.selfend)
		 throw new Error('must have BODY');


	return function(next, buf, context, tag_over) {
    var disable = context[IF_ELSE_KEY];
    if (disable || disable == undefined) {
      context.tag_scope.controler.disable_sub();
    }
    delete context[IF_ELSE_KEY];
    next();
  };
};
