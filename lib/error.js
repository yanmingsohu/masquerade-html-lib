

module.exports.SyntaxError = SyntaxError;


//
// 返回一个语法错误异常
//
function SyntaxError(_why, _line, _col, _filename) {

	var ret  = new Error(_why)
	ret.line = _line;
	ret.col  = _col;
	ret.name = 'SyntaxError';
	ret.file = _filename;
	ret.why  = _why;


	ret._rebuild_message = function() {
		var msg = [];
		msg.push('Syntax error');

		if (ret.file) {
			msg.push(' on "');
			msg.push(ret.file);
			msg.push('"');
		}

		if (ret.col>0 && ret.line>0) {
			msg.push(" at [");
			msg.push(ret.line);
			msg.push(",");
			msg.push(ret.col);
			msg.push("]");
		}

		msg.push(", ");
		msg.push(ret.why);
		ret.message = msg.join('');
	};


	var ptostring = ret.toString;

	ret.toString = function() {
		ret._rebuild_message();
		return ptostring.apply(ret);
	}

	ret._rebuild_message();
	return ret;
};
