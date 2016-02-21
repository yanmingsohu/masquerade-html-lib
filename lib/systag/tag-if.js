var tool = require('../tool.js');

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

		if (Boolean(_val) == n) {
			context.tag_scope.controler.disable_sub();
		}
    next();
  };
};
