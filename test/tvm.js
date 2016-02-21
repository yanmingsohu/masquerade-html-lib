var vm = require('vm');

var c = {a:2};

var b = vm.createContext(c);
b.tt = 100;
c.aa = 99;
vm.runInContext('(function() {d=tt; zz=aa;})()', b);


for (var n in b) {
  console.log('>', n, b[n]);
}