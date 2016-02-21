function saver() {
	var first = null;

	var ret = function(next, buf, context) {
		first(next, buf, context);
	};

	// 插入渲染器
	ret.add = function(renderFn) {
		if (!first) {
			first = renderFn;
		} else {
			var prv = first;
			first = function(next, buf, context) {
				prv(function() {
					renderFn(next, buf, context);
				}, buf, context);
			}
		}
	}
	return ret;
}


var s = saver();

s.add(function(next, buf, context) {
	console.log(1);
		next();
});

s.add(function(next, buf, context) {
	console.log(2);
		next();
});

s.add(function(next, buf, context) {
	console.log(3);
		next();
		next();
});

s.add(function(next, buf, context) {
	console.log(4);
		next();
});

s(function(next, buf, context) {
	console.log('over', next);
})