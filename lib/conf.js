var clib = require('configuration-lib');
var root = { data : clib.load() };


clib.wait_init(function() {
  root.data = clib.load();
});


module.exports.wait = clib.wait_init;

module.exports.load = function() {
  return root.data;
};


//
// 切换 public/private 配置到另一个配置上
// 比如: 默认总是使用 masquerade 这个配置, 如果需要使用 mas2 这个配置
// 则调用这个方法 change('mas2')
// 必须在库启动之前调用
//
module.exports.change = function(conf_name) {
  clib.wait_init(function() {
    conf = root.data;
    conf.masquerade.public  = conf[conf_name].public;
    conf.masquerade.private = conf[conf_name].private;
  });
};
