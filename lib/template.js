var base = require('./base.js');
var tool = require('./tool.js');
var SyntaxError  = require('./error.js').SyntaxError;

// 只有开始没有结束符的 HTML 标签
var notEndButEndTag = { '!doctype':1, 'meta':1, 'link':1 }
// 空字符的定义
var spch = { ' ':1, '\t':1, '\n':1, '\r':1 };
var __tag_id = 0;

// ko 索引的定义
var BEGIN     = 0,
    END       = 1,
    TYPE      = 2,
    NAME      = 3,
    ATTR      = 4,
    ATTR_STR  = 5,
    LINE      = 6,
    COL       = 7,
    I_LEN     = 8,
    SKIP_TAG  = 99,
    EXP_TAG   = '_bird_expression_',
    CALL_DEP  = '__cAlL_depth_save';


// 导出库
module.exports.html_complier        = html_complier;
module.exports.parseHtmlStructure   = parseHtmlStructure;

tool.addSystemVar('builder');    // rqa83
tool.addSystemVar('expression'); // rqa83
tool.addSystemVar('parse');      // rqa83
tool.addSystemVar('tag_scope');  // ct135
tool.addSystemVar(CALL_DEP);


//
// 编译 HTML 并返回渲染器
// 出现错误会抛出异常
//
// buf: Buffer -- 保存 html 代码的缓冲区
// filename: string -- 文件名用于输出错误消息, 可以 null
// _v_errorHandle: Function -- 设置错误捕获函数, 之后可以通过返回的对象修改
// _depth_max: Integer -- 标签嵌套调用的最大次数, 默认 10
//
// userTagFactory: Object
//    -- 用户自定义渲染器工厂, 结构: { KEY: Factory }
//    -- KEY:String -- 指明标签名称,
//    -- Factory: function(tag, userTagFactory, _v_errorHandle)
//    --    返回一个渲染器 [look: urp95, urp113]
//
//    -- tag 中保存有:
//    --    attr:{} -- 解析后的属性对象
//    --    attr_str:String -- 属性的原始字符串
//    --    selfend -- 如果没有标签体, 则为 true
//    --    allow_body -- 设置这个属性, 如果有标签体且设置这个属性为 false, 则抛出异常
//    --    identify -- 一个无重复的识别数字
//
// mark: hcbu39
//
function html_complier(buf, userTagFactory, _v_errorHandle, filename, _depth_max) {

  // 配对后的 ko, 可搜索: [pair 元素的结构]
  var pair = [];
  // 每个标签的起始/结束位置, 和标签类型
  var ko = [];
  var depth_max = _depth_max || 10;

  // 只保留 userTagFactory 中需要的 tag
  var name_filter = function(name) {
    if (userTagFactory[name] == null)
      return SKIP_TAG;
  };

  parseHtmlStructure(buf, ko, pair, name_filter, filename);

  var builder = base.html_builder();
  var renderQueue = builder.saver();
  var staticBufQueue = [];

  // 初始化上下文
  renderQueue.add(function(next, buf, context) {
    if (!context) throw new Error("context cannot be null.");

    // mark rqa83
    context.builder    = builder;
    context.expression = tool.expression_complier;
    context.parse      = tool.parseExp;

    if (!context[CALL_DEP]) {
      context[CALL_DEP] = [];
    }

    next();
  });

  createStaticTxtRenderQueue();
  createRenderQueue();
  clearMem();

  // 绑定一个方法, 由于修改错误捕获函数
  renderQueue.setErrorHandle = function(handle) {
    handle && (_v_errorHandle = handle);
  }

  return renderQueue;

  //
  // 因为 _v_errorHandle 会依每次调用改变,
  // 所以设置一个代理函数
  //
  function errorHandle(err) {
    _v_errorHandle(err);
  }

  //
  // 创建用户标签的渲染器
  // 被 renderBasicPack 包装
  //
  function userRenderPack(user_render_factory, p) {

    var user_render;

    try {
      p.allow_body = true;

      //
      // 这里决定用户自定义标签工厂函数原型
      // mark urp113
      //
      user_render = user_render_factory(p, userTagFactory, errorHandle, filename);

      if (p.allow_body == false && p.selfend == true) {
        throw new Error('not allow BODY');
      }
    } catch(complier_err) {
      return sendErr(complier_err);
    }

    return function(next, buf, context) {
      p.controler.enable_sub();

      //
      // 标签范围变量的创建
      //
      // mark ct135
      context.tag_scope = {
        name: p.name,
        body: p.body,
        attr: p.attr,
        attr_str  : p.attr_str,
        controler : p.controler,
        filename  : filename,
      };

      //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      //
      // 这里决定自定义渲染器函数的参数, 和 context 中的对象
      //
      // tag_over -- function(cb) 当标签结束时 cb 被调用(此时 attr_str 无效)
      //          -- 自结束标签, 这个属性为 null, cb 返回 'stop' 会终止渲染
      //
      // mark: urp95
      //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      try {
        user_render(_over_clear_val, buf, context, p.tag_over);
      } catch(run_time_err) {
        return sendErr(run_time_err);
      }

      function _over_clear_val() {
        context.tag_scope = null;
        next();
      }
    };

    function sendErr(err) {
      var e = SyntaxError("[" + p.name + " Tag] "
            + err.message, p.line, p.col, filename);
      errorHandle(e);
      //
      // 返回一个空渲染器, 并且到此为止, 不再渲染
      //
      return function(next, buf, context) {
      };
    }
  }

  //
  // 返回表达式渲染器
  // 被 renderBasicPack 包装
  //
  function expressionRender(pair) {
    var exp = tool.expression_complier(pair.attr_str);

    return function(next, buf, context) {
      try {
        var ret = exp.val(context);

        if (typeof ret != 'string') {
          ret = JSON.stringify(ret);
        }
        if (ret) {
          buf.write(ret);
        }
      } catch(err) {
        buf.write(err.message);
      }

      next();
    }
  }

  //
  // 清理掉内存引用
  //
  function clearMem() {
    pair
      = ko
      = staticBufQueue
      = name_filter
      // = renderQueue // 不能删除
      = null;
  }

  //
  // 把所有渲染器按顺序拼装起来
  //
  function createRenderQueue() {
    var staticBegin = 0;
    var sbq_len     = staticBufQueue.length;
    var pair_len    = pair.length;

    for (var i = 0; i < pair_len; ++i) {
      var tpair = pair[i];
      var controler = tpair.controler = createControler();
      var body_bufs = tpair.body = [];

      tpair.identify = ++__tag_id;

      // 把这个标签之前的静态文本压入渲染队列
      while (staticBegin < sbq_len) {
        if (staticBufQueue[staticBegin].begin < tpair.b1) {
          renderQueue.add(staticBufQueue[staticBegin].render);
          ++staticBegin;
        } else {
          break;
        }
      }

      if (!tpair.selfend) {
        tpair.tag_over = createOverCall();
        var lastTag = null;

        // 将标签体中的文本对象引用记录在标签对象中,
        // 允许标签对象修改这些文本
        // 同时允许标签对象控制这些文本 (通过控制器)
        for (var si = staticBegin; si < sbq_len; ++si) {
          if (staticBufQueue[si].begin < tpair.e2) {
            body_bufs.push(staticBufQueue[si].buf);
            controler.add_sub(staticBufQueue[si]);
            lastTag = staticBufQueue[si];
          } else {
            break;
          }
        }

        // 将标签体中的标签对象引用记录在标签对象中,
        // 允许标签对象对这些标签进行控制
        for (var ni = i+1; ni < pair_len; ++ni) {
          if (pair[ni].b1 < tpair.e1) {
            controler.add_sub(pair[ni]);

            // lastTag 插入的文本对象可能比当前的标签对象更靠后
            if (lastTag == null || pair[ni].b1 > lastTag.b1) {
              lastTag = pair[ni];
            }
          } else {
            break;
          }
        }

        // 将标签的结束通知函数, 传递给标签体中的最后一个标签
        lastTag.parent_tag_over = tpair.tag_over.call;
      }

      // 标签本身的渲染器加入队列, 对表达式进行的特殊处理
      var render =
        tpair.name == EXP_TAG
          ? renderBasicPack(tpair, expressionRender(tpair))
          : renderBasicPack(tpair, userRenderPack(userTagFactory[tpair.name], tpair));

      renderQueue.add(render);
    }

    // 末尾的渲染器
    for (var i = staticBegin; i < sbq_len; ++i) {
      renderQueue.add(staticBufQueue[i].render);
    }
  }

  //
  // 创建静态文本分段渲染队列
  //
  function createStaticTxtRenderQueue() {
    var begin = 0;

    for (var i = 0; i < ko.length; i += I_LEN) {
      addpart(begin, ko[i + BEGIN]);
      begin = ko[i + END] + 1;
    }

    if (begin < buf.length) {
      addpart(begin, buf.length);
    }

    // 创建一个缓冲区的分片
    function addpart(begin, end) {
      var partbuf = buf.slice(begin, end);

      //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      //
      // 静态文本元素的结构
      //
      // mark: ap230
      //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      var txt_item = {
        begin  : begin,
        end    : end,
        buf    : partbuf,
        enable : true
      };

      txt_item.render = renderBasicPack(
          txt_item, builder.txt(txt_item.buf));

      staticBufQueue.push(txt_item);
    }
  }

  //
  // 包装一个可渲染元素和一个渲染器, 返回的渲染器实现基础功能
  //
  // item -- 可渲染元素, 有 enable 属性控制是否渲染
  //      -- parent_tag_over 方法通知父标签渲染结束
  //      -- 如果 parent_tag_over 返回 'stop' 则停止渲染
  // render -- 被包装的渲染器, 实现具体的逻辑
  //
  function renderBasicPack(item, render) {
    var id = item.identify ? filename +':'+ item.identify : null;

    return function(next, _buf, context) {
      if (item.enable) {
        if (add_check_depth(context) == false) {
          var e = SyntaxError("[" + item.name + " Tag] overflow max depth call "
                + depth_max , item.line, item.col, filename);

          errorHandle(e);
          return;
        }

        render(basic_over, _buf, context);
      } else {
        next();
      }

      function basic_over() {
        // console.log('call over', item.name)
        var do_next = true;
        // 可能会减到负数, 因为不是从渲染器开始处调用的
        decrease_depth(context);

        // parent_tag_over 与 createOverCall.call 绑定
        // 返回 stop 之后, 还可以通过 调用 next 来继续渲染
        if (item.parent_tag_over) {
          do_next = ( 'stop' !=  item.parent_tag_over(next));
        }

        if (do_next) {
          next();
        }
      }
    };

    function decrease_depth(context) {
      if (!id) return;
      context[CALL_DEP][id] -= 1;
      // console.log('-call', context[CALL_DEP][id], id)
    }

    function add_check_depth(context) {
      if (!id) return true;

      var calld = context[CALL_DEP];
      if (isNaN(calld[id])) {
        calld[id] = 0;
      }

      // console.log('+call', calld[id], id)
      calld[id] += 1;
      return calld[id] < depth_max;
    }
  }
}

//
// 控制器, 在父元素和子元素之间传递
// 隐藏变量, 防止在上下文中越界操作
//
function createControler() {
  var ret = {
  };

  var _sub = [];
  var state = 'unknow';

  ret.disable_sub = function() {
    _sub.forEach(function(item) {
      item.enable = false;
    });
    state = 'diable';
  };

  ret.enable_sub = function() {
    _sub.forEach(function(item) {
      item.enable = true;
    });
    state = 'enable';
  };

  ret.state_sub = function() {
    return state;
  };

  ret.add_sub = function(obj) {
    obj && _sub.push(obj);
  }

  return ret;
}

//
// 当标签体中的最后一个标签结束渲染后
// 通知父标签
//
function createOverCall() {
  var ovar_cb = null;

  var ret = function(_ovar_cb) {
    ovar_cb = _ovar_cb;
  };

  ret.call = function(x) {
    // if (!ovar_cb) {
    //   console.error("call but no fn")
    // }
    return ovar_cb && ovar_cb(x);
  };

  return ret;
}

//
// 解析 buf:Buffer 中的 HTML 数据
// 结果存入 pair:[], filter 做过滤
// filter == null, 可以解析出所有的标签
//
function parseHtmlStructure(buf, ko, pair, filter, filename) {
  var len  = buf.length;

  init();

  if (ko.length % I_LEN != 0) {
    throw new Error('ko offset error');
  }

  dopair();
  return;

  //
  // ko 中的标记进行配对, 保存在 pair
  //
  function dopair() {
    var b=0, e= 0;

    while (b < ko.length) {
      var rect;
      var ty = ko[b + TYPE];

      if (ty == 'begin') {
        e = b + I_LEN;
        var deb = 1;
        var find = false;

        while (e < ko.length) {
          if (ko[e + TYPE] == 'end') {
            --deb;
            if (deb == 0 && ko[e + NAME] == ko[b + NAME]) {
              find = true;
              break;
            }
            else if (deb < 0) {
              break;
            }
          } else if (ko[e + TYPE] == 'begin') {
            ++deb;
          }

          e += I_LEN;
        }

        if (find) {
          rect = {
            b1 : ko[b + BEGIN], b2: ko[b + END],
            e1 : ko[e + BEGIN], e2: ko[e + END],
            selfend: false
          };
        } else {
          throw SyntaxError("Syntax error cannot find END tag `" +
              ko[b + NAME] + "`", ko[b + LINE], ko[b + COL], filename);
        }

      } else if (ty == 'self') {

        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //
        // pair 元素的结构 1
        //
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        rect = {
          b1 : ko[b + BEGIN], b2: ko[b + END],
          e1 : -1,            e2: ko[b + END],
          selfend: true
        };
      }

      if (rect) {
        //
        // pair 元素的结构 2
        //
        rect.name     = ko[b + NAME];
        rect.attr     = ko[b + ATTR];
        rect.attr_str = ko[b + ATTR_STR];
        rect.line     = ko[b + LINE];
        rect.col      = ko[b + COL];
        rect.enable   = true;

        pair.push(rect);
        rect = null;
      }
      b += I_LEN;
    }
  }

  //
  // 将 html 标记的位置记录在 ko 中
  //
  function init() {
    var line = 1, col = 1;
    var flag = 1;
    var a, b, i = 0
    var exc = 0;
    var name, endmark, type;
    var scriptindex = 0;

    while(i < len) {
      var ch = buf[i];

      if (flag == 1) { // 寻找 '<'' 字符 作为标签的开始
        if (ch == '#') {
          flag = 3;
          continue;
        }

        if (ch == '<') {
          ko.push(i);
          a = i;
          flag = 2;

        } else if (ch == '>') {
          if (name != 'script') {
            // throw SyntaxError('should not `>` ' +
            //     buf.toString().substr(i-50,99), line, col, filename);
            // 这个逻辑既不是错误, 也不是警告
            // console.warn('should not `>` near:`' +
            //     buf.toString().substr(i-10, 30), '` at [', line, col, ']', filename)
          }
        }
      }

      else if (flag == 6) { // script 标记不允许有子标签, 注释中的, 字符串中的未处理
        var scriptEnd = '</script>';

        if (spch[ch] != 1) {
          if (ch == scriptEnd[scriptindex]) {
            if (++scriptindex >= scriptEnd.length) {
              i = a = (i - scriptEnd.length +1);
              ko.push(a);
              // console.log('is script find end', a, line, ko, buf[a]);
              flag = 2;
            }
          } else {
            scriptindex = 0;
          }
        }
      }

      else if (flag == 2) { // 找到 '<' 后寻找 '>' 作为标签结束
        // 掠过注释
        if (ch == '!' && a+1==i) {
          if (buf[i+1] == '-' && buf[i+2] == '-') {
            var u = i;
            while (u < len) {
              if (buf[u] == '\n') { ++line; col=0; }
              else
              if (buf[u] == '-' && buf[u+1] == '-' && buf[u+2] == '>') {
                i = u + 3; break;
              }
              ++u;
            }
            if (u >= len) {
              throw SyntaxError('Comment not END!', line, col, filename);
            }
            flag = 1;
            ko.pop();
            continue;
          }
        }

        else if ((ch == "'" || ch == '"') && (buf[i-1] != '\\')) {
          if (endmark) {
            if (endmark == ch) endmark = null;
          } else {
            endmark = ch;
          }
        }

        else if (ch == '>') {
          if (endmark) { ++i; continue; }
          ko.push(i);
          b = i;
          flag = 1;
          name = findAttr(a, b, line, col);
          type = ko[ko.length - I_LEN + TYPE];

          if (filter && (filter(name) == SKIP_TAG)) {

            for (var ski=0; ski<I_LEN; ++ski)
              ko.pop();

            i = a+1; // 偏移回到 '<' 符号的下一位
          }
          else if (name == 'script' && type == 'begin') {
            flag = 6;
            continue;
          }

        } else if (ch == '<') {
          if (endmark) { ++i; continue; }
          // throw SyntaxError('should not `<`:: ' +
          //     buf.toString().substr(i-10,30), line, col, filename);

          // 这个逻辑既不是错误, 也不是警告
          // console.warn('should not `<` near `' +
          //     buf.toString().substr(i-10, 30), '` at [', line, col, ']', filename)
        }
      }
      else if (flag == 3) {
        if (ch == '#') {
          if (++exc >= 3) { // 出现 ### 开始表达式
            a = i - 2;
            flag = 4;
          }
        } else {
          exc = 0;
          flag = 1;
          continue;
        }
      }
      else if (flag == 4) {
        if (ch == '#') {
          if (--exc <= 0) { // 出现 ### 结束表达式
            b = i;
            flag = 1;

            ko.push(a);
            ko.push(b);
            ko.push('self');
            ko.push(EXP_TAG);
            ko.push(null);
            ko.push(buf.slice(a+3, b-2));
            ko.push(line);
            ko.push(col);
          }
        } else if (exc == 3) { // 表达式没有结束
          if (ch == '\r' || ch == '\n') {
            throw SyntaxError("expression not allowed new line",
                line, col, filename);
          }
        } else {
           throw SyntaxError("expression end invalid char:" + ch,
              line, col, filename);
        }
      }

      if (ch == '\n') {
        // if (flag > 2) throw SyntaxError("Tag New Line is not allowed " +
        //     buf.toString().substr(i-10, 30), line, col, filename);

        ++line; col = 0;
      }
      else ++col;
      // 使用 continue 可以跳过 ++i, 就是把字符重新处理一次
      ++i;
    }
  }

  function findAttr(a, b, line, col) {
    var f = 0;
    var n=[], v=[], endmark, skip=0;
    var tagname = [];
    var selfend = false;
    var isend = false;
    var attr = {};
    var attr_str = [];

    // 第一次 ++a 可以跨过首个符号 '<'
    while (++a<b) {
      var c = buf[a];

      if (c == ' ' || c == '\t' || c == '\n') {
        if (f == 3) {
          v.push(c);
        }
        else if (f == 0) {
          if (tagname.length > 0) f = 1;
        }
        // Else skip sp
      }
      else if (f == 4) {
        throw SyntaxError("Tag end but some invaild char: "
            + buf.toString().substr(a-10, 50), line, col, filename);
      }
      else if (f == 3) {
        if (c == endmark) {
          attr[n.join('')] = v.join('');
          n = [];
          v = [];
          f = 1;
          endmark = null;
        } else {
          v.push(c);
        }
      }
      else if (f == 2) {
        if (c == "'" || c == '"') {
          endmark = c;
          f = 3;
        }
      }
      else if (f == 1) {
        if ((c == "'" || c == '"') && endmark == null) {
          endmark = c;
        }
        else if (c == endmark) {
          endmark = null;
        }
        else if (c == '/' && endmark == null) {
          selfend = true;
          f = 4;
        }
        else if (spch[c] != 1) {
          if (c == '=') {
            f = 2;
          } else {
            n.push(c);
          }
        }
      }
      else /* if (f == 0) */ {
        if (c == '/') {
          if (tagname.length > 0) {
            selfend = true;
          } else {
            isend = true;
          }
        } else if (spch[c] != 1) {
          tagname.push(c);
        }
      }

      if (f > 0 && f < 4) {
        if (!selfend) {
          attr_str.push(c);
        }
      }
    }

    tagname = tagname.join("").toLowerCase();

    if (selfend || notEndButEndTag[tagname])
                    { ko.push('self');  }
    else if (isend) { ko.push('end');   }
    else {            ko.push('begin'); }

    ko.push(tagname);
    ko.push(attr);
    ko.push(attr_str.join(''));
    ko.push(line);
    ko.push(col);
    return tagname;
  }

}
