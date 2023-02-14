var vm = require('vm');

var c = {a:2};

var b = vm.createContext(c);
b.tt = 100;
c.aa = 99;
vm.runInContext('(function() {d=tt; zz=aa;})()', b);


for (var n in b) {
  console.log('>', n, b[n]);
}


setInterval(function() {
  // nodejs 6.x 上下文对象不再内存泄漏
  var b = vm.createContext({});
  console.log('!', new Date())
}, 10);
