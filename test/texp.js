var tool = require('../lib/tool.js');

var exp = tool.expression_complier('a.b');

var v = {a:{ 'b': 11 } };

console.log( exp.val(v) );
console.log( exp.val(v, 12) );
console.log( v );


// ====


var exp = tool.expression_complier('a.b-c');

var v = {a:{ 'b-c': 11, b:10 }, c:8 };

console.log( exp.val(v) );
// console.log( exp.val(v, 12) ); // 复杂表达式不能赋值
console.log( v );


// ====


var exp = tool.expression_complier('a.b-c', true);

var v = {a:{ 'b-c': 11 }};

console.log( exp.val(v) );
console.log( exp.val(v, 20) ); // 复杂表达式不能赋值
console.log( v );