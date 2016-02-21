var tool = require('../index.js').tool;
var net  = require('mixer-lib').util.net();
var vm   = require('vm');

var ctx = { 
	a:'hello', 
	b:{c:['world']}, 
	xy:{ni:'hao'} ,
	bool: true
};
var ec1 = tool.expression_complier('a');
var ec2 = tool.expression_complier('b.c.0');

console.log('================================== test ctx');
// out : hello world
console.log( ec1.val(ctx), ec2.val(ctx) );

// console.log('================================== test net');
// var url = 'http://www.baidu.com';

// var req = net.get(url, {}, function(err, data) {
// 	  console.log('api', err, '>>>>>>>>>>\n', data && data.txt());
// });

console.log('================================== test parseExp');
var r;
r = tool.parseExp("abc");
console.log('must abc ==', r.val(ctx));

r = tool.parseExp("###a###/abc");
console.log('must hello/abc ==', r.val(ctx));

r = tool.parseExp("abc/###a###");
console.log('must abc/hello ==', r.val(ctx));

r = tool.parseExp("abc/###a###/xyz");
console.log('must abc/hello/xyz ==', r.val(ctx));

r = tool.parseExp("abc/###xy###/xyz/###bool###");
console.log('?? ==', r.val(ctx));

console.log('================================== test sandbox');
try {
	var fn = vm.runInNewContext("(function (a, console) { console.log(a); })");
  console.log(typeof fn)
  fn('1231', console);
} catch(e) {
	console.log('vm:', e);
}

// process.exit(0)