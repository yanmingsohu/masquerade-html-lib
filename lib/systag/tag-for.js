var tool = require('../tool.js');
var util = require('util');

var FOR_DEP = '__foR_Dep_save';
tool.addSystemVar(FOR_DEP);

//
// <for from="array" save='b'  index='i'> ###b### ###i###</for> 
// <for from="object" save='c' index='i'> ###c### ###i###</for> 
//     循环渲染 标签体
//     每次循环的变量都保存在 save 指定的变量中, 之后可以通过表达式取出
//     每次循环的索引保存在 index 指定的变量中
//
// 嵌套有问题!!!!
//
module.exports = function(taginfo) {

  if (taginfo.selfend) throw new Error('must have BODY');

  var from    = geta('from'); 
  var from_ex = tool.expression_complier(from);
  var save    = geta('save');
  var index   = taginfo.attr['index'];


  return function(next, buf, context, tag_over) {
    // console.log('for in');

    function notNext() {
      scope.controler.disable_sub();
      return next();
    }

    var obj = from_ex.val(context);
    var scope = context.tag_scope;
    // 如果取出 from 的数据是空, 则不渲染子标签
    if (!obj) return notNext();

    var iter = newIterator(obj);
    // 如果参数无法循环也不会渲染子标签
    if (!iter) return notNext();

    var out_count = 0;

    tag_over(function() {
      // console.log('for out', out_count, iter.test())
      //
      // if 中的标签体渲染完成, 如果还需要循环
      // 则终止当前渲染, 并重新调用标签体
      //
      if (iter.has()) {
        repeatRenderSub();
        return "stop";
      } else {
        // 嵌套循环, 这里会退出多次防止这种情况
        if (out_count++ > 0) {
          return 'stop';
        }
        // scope.controler.enable_sub();
      }
    });

    repeatRenderSub();

    function repeatRenderSub() {
      if (iter.has()) {
        var loopvar = iter.next();
        context[save] = loopvar;

        if (index) {
          context[index] = iter.index();
        }
        next();
      } else {
        notNext();
      }
    }
  };

  function newIterator(obj) {
    if (typeof obj == 'object') {
      if (util.isArray(obj)) {
        return newArrayIterator(obj);
      } else {
        return newObjectIterator(obj);
      }
    } 
    return null;
  }

  function newObjectIterator(obj) {
    var arr = [];
    var i = -1;

    for (var n in obj) {
      arr.push(n);
    }

    return {
      // 迭代器调用顺序, has > next > index, 
      // next 会跳转到下一个位置
      has: function() {
        return i+1 < arr.length;
      },
      next: function() {
        return obj[arr[++i]];
      },
      index: function() {
        return arr[i];
      },
      test: function() {
        return arr;
      }
    }
  }

  function newArrayIterator(arr) {
    var i = -1;

    return {
      has: function() {
        return i+1 < arr.length;
      },
      next: function() {
        return arr[++i];
      },
      index: function() {
        return i;
      },
      test: function() {
        return arr;
      }
    };
  }

  function geta(name, defaultValue) {
    var r = taginfo.attr[name] || defaultValue;
    if (r == null || r == '') {
      throw new Error('must have ' + name + ' attribute');
    }
    return r;
  }
};
