var tool = require('../tool.js');
var SLICE_KEY = '__SLicE_save';

tool.addSystemVar(SLICE_KEY);


//
// `<slice ref='name' attr1='' attr2='' noerror='1'/>`
// `<slice define='name' noerror='1'>BODY</slice>`
//     创建一个切片, 如果有 ref 属性, 则不能有标签体, 用于引用一个切片到当前位置
//     并且 扩展属性都会传入上下文供给 <slice define/> 的 body 中使用
//     如果有 define 属性, 则必须有标签体, 切片只有在被引用的时候才会渲染
//     如果定义 noerror 则不会因为错误抛出异常, 否则不要定义
//
module.exports = function(taginfo) {

  var to    = taginfo.attr['define'];
  var from  = taginfo.attr['ref'];
  var noerr = taginfo.attr['noerror'];


  if (isNull(to) && isNull(from)) {
    throw new Error('must have "define" or "from" attribute');

  } else if (!isNull(from)) {
    if (taginfo.selfend == false) {
      throw new Error('"ref" attribute must not have BODY');
    }

  } else if (!isNull(to)) {
    if (taginfo.selfend == true) {
      throw new Error('"define" attribute must have BODY');
    }
  } else {
    throw new Error('"define" and "ref" attribute not together');
  }

  for (var n in taginfo.attr) {
    if (tool.isSystemVar(n)) {
      throw new Error('cannot modify system var "' + n + '"');
    }
  }


  if (from) { // IF (ref)

    return function(next, buf, context, tag_over) {
      if (context[SLICE_KEY] && context[SLICE_KEY][from]) {
        var renderNext = context[SLICE_KEY][from].render;
        sendAttrToTarget();
        renderNext(next);
      } else if (noerr) {
        next();
      } else {
        throw new Error('Ref slice but not exists: ' + from);
      }

      // 传递参数给 define 使用
      function sendAttrToTarget() {
        for (var n in taginfo.attr) {
          if (n == 'define' || n == 'ref') continue;
          if (context[n]) {
            tool.comment(buf, 'var has exists will overlay:', n);
          }
          context[n] = taginfo.attr[n];
        }
      }
    };

  } else { // IF (define)

    return function(next, buf, context, tag_over) {
      var scope = context.tag_scope;
      // to 在原位置不会进行渲染
      scope.controler.disable_sub();
      // console.log('slice define begin', to)

      if (!context[SLICE_KEY]) {
           context[SLICE_KEY] = {};
      } else if (context[SLICE_KEY][to]) {

        // for 循环中会重复渲染, 防止抛出错误
        if (context[SLICE_KEY][to].identify === taginfo.identify || noerr) {

          // 即使重复的直接调用, 也不会渲染
          scope.controler.disable_sub();
          return next();
        } else {
          throw new Error('create slice but exists: ' + to);
        }
      }

      // 保存引用这个切片的切片的 next
      var _pnext = [];
      var out_count = 0;

      // 导出函数给 from 用
      context[SLICE_KEY][to] = {
        render: renderNext,
        identify: taginfo.identify,
      };

      tag_over(function() {
        // fixbug. 在标签结束后又一次渲染!
        scope.controler.disable_sub();

        // _pnext 有效说明是通过 renderNext 调用的, 所以要结束在标签的结束
        if (_pnext.length > 0) {
          // console.log('slice over', to)
          _pnext.pop()();
          return 'stop';
        } 
        // else {
        //   console.log('slice define over', to);
        // }
      });

      // 完成所有初始化才能返回
      next();

      function renderNext(___pnext) {
        // console.log('slice begin', to);
        scope.controler.enable_sub();
        _pnext.push(___pnext);
        next();
      }
    };

  } // End else

  function isNull(s) {
    return s == null || s == '';
  }
};
