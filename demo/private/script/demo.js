
// 输出到日志文件
// log: { log(), warn(), error(), info() }
// console 是别名

// 请求的参数
// query : {}
// session: {}

// 脚本结束调用这里，必须！！
// end()

// 向流中输出字符
// write(...)

// 在请求上下文中设置变量
// val('name', value)

// 从请求上下文中取得变量
// var some = val('name');

// 请求一个脚本
// require()
// module.exports 导出对象

if (!this.i) {
	this.i = 0 ;
}

var retFn = require('require.js');
write(retFn(++this.i));

var msg = '<br/>this is Private script';
console.info(msg);
write(msg);
write('</br>')
write(JSON.stringify(this));


end();