
module.exports = exportForMix;

module.exports.base 
    = require('./lib/base.js');

module.exports.template 
    = require('./lib/template.js');

module.exports.tool 
    = require('./lib/tool.js');

module.exports.mid 
    = require('./lib/mid.js');


//
// after_create : function(mas_mid) 在中间件对象创建后回调, 用于加载插件
//
function exportForMix(app_pool, url_base, after_create) {
  var mixer        = require('mixer-lib');
  var route_saver  = mixer.create_route_saver();
  
  var mid = module.exports.mid(route_saver(url_base || '/'));
  after_create && after_create(mid);

  var route = app_pool.addApp(mixer.native(mid));
  route.add(route_saver);
}
  

if (!module.parent) {
  var mixer = require('mixer-lib');

  var conf = {
    whenLoad: exportForMix
  };

  mixer.create_http_mix_server(conf);
}