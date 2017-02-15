
//
// 加载系统标签到 tagFactory 中
//
module.exports = function(tagFactory) {

	load('if');
	load('else');
	load('for');
	load('include');
	load('slice');
	load('create');
	load('script');
	load('wait');

	// 会改动系统变量, 放在最后做检查
	load('set');
	load('del');
	load('api');
	load('auth');
	load('pit');
  load('never');
	load('stop');

	// 迁移到单独的项目中
	// load('sql');

	//
	// 初始化失败立即停止, 不要尝试 catch 异常
	//
	function load(name) {
		if (tagFactory[name])
			throw new Error("系统标签渲染器安装失败, 标签已经存在:" + name);

		tagFactory[name] = require('./systag/tag-' + name + '.js');
	}
};
