var path = require('path');


var config = module.exports = {

	logLevel: 'ALL',
   env : 'development',
   port: 8088,

	masquerade : { // on work
   // 公共访问目录, web 资源根目录, 绝对目录
   public         : path.normalize(__dirname + "/../demo/public"),
   // 私有目录, 脚本等文件目录, 绝对目录
   private        : path.normalize(__dirname + "/../demo/private"),
   // 是服务器端运行的 html 代码的扩展名, 没有 '.'
   extname        : 'htm',
   // include / slice 会引起循环嵌套, 这里指定最大的嵌套层级
   depth_max      : 10,
   // 文件缓存时间, 秒
   cache_time     : 3 * 60,
   // 缓存一个文件的最大尺寸, 超过这个不会缓存
   max_file_size  : 2 * 1024*1024,
   // 文件的编码
   encoding       : 'utf8',
   // 根路径默认页面在 public 目录中, 文件同时存在, 优先使用前面的
   default_page   : 'index.htm,index.html',
   // 模板上下文可读取的配置
   runtime_cfg    : {}
	}

};

// config.masquerade.public  = 'E:\\web4node\\public\\';
// config.masquerade.private = 'E:\\web4node\\private\\';
