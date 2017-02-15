var tool = require('../tool.js');
var IF_ELSE_KEY = '__if_else_var';

tool.addSystemVar(IF_ELSE_KEY);

//
// <if var="c" [not='true']></if>
//
// not==true 会取反结果
// var 未定义会抛出异常
//
module.exports = function(taginfo) {

	if (taginfo.selfend)
		 throw new Error('must have BODY');

	var v = taginfo.attr['var'];
	var n = taginfo.attr['not'];

	if (!v)
		throw Error("must 'var' attribute");

	var ex = tool.expression_complier(v);
	n = Boolean(n);


	return function(next, buf, context, tag_over) {
		var _val = ex.val(context);

		if (isNaN(_val)) {
			if (_val == 'false') _val = false;
		} else {
			_val = Number(_val);
		}

		var disable = Boolean(_val) == n;

		if (disable) {
			context.tag_scope.controler.disable_sub();
			context[IF_ELSE_KEY] = !disable;
		} else {
			delete context[IF_ELSE_KEY];
		}

		tag_over(function() {
			context[IF_ELSE_KEY] = !disable;
		});
    next();
  };
};
