# 渲染动态 html 页面

* 通过插件扩展功能
* 全程使用 Buffer 且尽量减少内存复制
* 静态文件最后修改日期缓存策略
* 自定义文件获取器, 可以挂到自定义的网络文件系统


## Install

`npm install masquerade-html-lib --save`


## Demo


### 快速启动服务

```js
var mas = require('masquerade-html-lib');
var ret = mas.listen(80);
```


### 使用原生 http api:

```js
var http = require('http');
var mas = require('masquerade-html-lib');
var mid = mas.mid('/www');
http.createServer(mid).listen(80);
```


### 与 mixer-lib 结合使用的方法:

```js
var mixer = require('mixer-lib');
var mas = require('masquerade-html-lib');

mixer.create_http_mix_server({
    whenLoad: function(app_pool) {
        mas(app_pool, '/');
    }
});
```


## Api

### var mas = require('masquerade-html-lib')

    mas 本身是一个函数: `Function(Object app_pool, String baseurl, Function mid_created_cb(Mid mid))`
    这个函数为 `mixer-lib` 设计; app_pool 是 mixer:whenLoad 的回调对象;
    baseurl 服务路径, 当中间件被创建完成 mid_created_cb 会被调用并传递 mid 对象;

#### mas.mid(String baseurl, Object _config, Bool _debug, FSObject _fs_lib)

    baseurl 服务的路径, mas 将这个路径作为服务的根路径映射到 public 的本地路径上;
    _config 配置参数, 设置为空则从配置文件中加载, 注意此时需要等待配置加载完成, 见 `configuration-lib`;
    _debug  设置为 true 出错后将在客户端打印完整的程序堆栈 (这将泄漏本地路径);
    _fs_lib 默认为系统 fs;
    返回: Mid 对象
    
#### mas.listen(port, [path, callback])

    在 port 端口上启动 http 服务, 并设置一个服务路径 path (默认 '/'), 
    当服务器启动 callback 函数被调用, 返回 
    `{ http : Class http.Server (HTTP)[https://nodejs.org/dist/latest-v6.x/docs/api/http.html], 
      mid : Class Mid }`

### Class Mid

    这是一个实例化的中间件, 需要挂载到 http 服务器上, 每个实例都可以配置成不同的状态.

#### Mid.add_plugin(info)

    将插件放入服务中, 多个服务的插件配置可以是不同的, 创建插件见 '插件' 一节.
    
### 其他 api, 列出只作为完整性参考, 他们都是内部实现, 切可能变更接口

#### mas.template.html_complier
#### mas.template.parseHtmlStructure
#### mas.tool.string_buf
#### mas.tool.rendering
#### mas.tool.expression_complier
#### mas.tool.isSystemVar
#### mas.tool.addSystemVar
#### mas.tool.forEachSystemVar
#### mas.tool.comment
#### mas.tool.nextId
#### mas.tool.parseExp
#### mas.base.html_builder


## 目录结构

> 这些配置在 config/config.js 中, 这些目录必须存在, 否则会出错

```
/[masquerade dir]           -- 项目根目录

    /private                -- 浏览器不可以直接访问的目录
        /include            -- 包含目录
        /script             -- node 脚本目录
        /tag                -- 自定义标签库目录

    /public                 -- 浏览器可以直接访问的目录
        /[some ohter]
```


## Html 模板说明

* 配置文件中 masquerade.extname 指定的的扩展名称的文件作为模板进行解析
* 模板中 `###A###` 的部分是 bird 表达式, 见下文
* 标签分为三种:
  - 1. 普通 html 标签, 不做特殊处理, 可以在标签体或属性中嵌入 bird 表达式
  - 2. 系统标签, 这些标签有特殊的功能, 渲染结果也不是直观的, 具体见 [Html 模板特殊标签] 一节
  - 3. 用户自定义标签, 这些标签使用 HTML 语法写成, 放在 [/private/tag] 目录中, 见下文


## bird 表达式

`###A.b###`

* 表达式以 ### 作为开始, 以 ### 作为结束
* 表达式中只支持从 '.' 运算符, 变量之间允许有空格
* 表达式只在普通文本中生效, 特殊标签的属性, 有不同的行为, 具体查看特殊标签的定义
* 上下文即 context 对象, 这个对象不需要在表达式中写出, 上下文参考 [上下文中的对象] 一节.
* 在一些特殊标签中, `###` 这个符号是不需要写出的, 具体查看特殊标签的定义


## 用户自定义 HTML 标签库

允许利用 HTML 语法定义程序库, 使定义和使用更符合前端开发者的习惯; 这些标签库都是由服务端渲染的.

自定义标签在 /private/tag 目录, 文件名(不含扩展名, 比如 user.htm 即 user 标签) 即为标签的名称; 这些标签直接在模板中使用, 引用的方式: `<user v='100'/>`; 引用标签的的时候, 参数都会作为上下文变量传递给此标签定义部分;

当调用自定义 HTML 标签且含有标签体时, 标签体中的内容并不会自动渲染, 必须使用 `<pit/>` 这个标签来渲染调用时的标签体, 标签体中也是模板语法.

如果有子目录则使用 html 名字空间来引用子目录, 子目录的子目录使用 '-' 分割, 所有目录名称不要有 `-` 这个符号.

引用自定义标签的例子, 定义的位置 ==> 引用的语法
* 例: `[/private/tag]/tag1.html            ==>  <tag1 />`
* 例: `[/private/tag]/sub1/tag2.html       ==>  <sub1:tag2 />`
* 例: `[/private/tag]/sub1/sub2/tag3.html  ==>  <sub1-sub2:tag3 />`


## Html 模板特殊标签

* 特殊标签是系统定义的, 或通过安装插件得到的功能.
* 没有标签体的标签, 即使声明了标签体也不会被渲染.
* 标签属性中不能有表达式, 表达式的使用要遵从标签的说明.
* 属性的解析方法, 不同的标签定义不同, 下文中的*变量*意思是从上下文对象中取一个属性作为当前值
* 可选的属性使用 `[]` 符号包含, 实际使用时不要有 `[]` 符号


### slice 切片

`<slice ref='name' attr1='' attr2='' noerror='1'/>`
`<slice define='name' noerror='1'>BODY</slice>`
*   创建一个切片, 如果有 ref 属性, 则不能有标签体, 用于引用一个切片到当前位置
    并且 扩展属性都会传入上下文供给 <slice define/> 的 body 中使用
    如果有 define 属性, 则必须有标签体, 切片只有在被引用的时候才会渲染
    如果定义 noerror 则不会因为错误抛出异常 (如无效的引用), 否则不要定义!

### include 包含

`<include src="/page/a.html" [private="false"] [exp='false']/>`
*   包含一个静态文件, 文件层级默认相对于 public 目录
    如果 private="true" 则相对于 /private/include 目录

### for 循环

`<for from="array" save='b'  index='i'> ###b### ###i###</for> `
`<for from="object" save='c' index='i'> ###c### ###i###</for> `
*   循环渲染 标签体
    每次循环的变量都保存在 save 指定的变量中, 之后可以通过表达式取出
    每次循环的索引保存在 index 指定的变量中

### if 判断

`<if var="c" [not='true']></if>`
*   如果条件为 true(默认) 则渲染标签体,
    如果 not='true' 则条件取反

### api 发出 HTTP 请求

`<api url='http://url/?parm' to='api1ret' [type='json/txt'] [method='get/post'] [exp='boolean']/>`
*   请求一个 API, method 指定方法 (默认get),
    使用 type 指定的类型解析数据 (默认为 json)
    并把结果保存在 to 指定的变量中;
    exp=true 则 url 中允许表达式

### create 创建对象

`<create to='varname' name-s='string' b-e='express' c-n='9' />`
*   创建一个对象 Object, 放入上下文的 to 指定的变量中
    参数的说明: 由 nnn-T 形成的参数列表 nnn 指定一个属性, T 指定数据类型
    T 的有效类型: 's': 字符串, 'e':表达式, 'i':整数, 'f':浮点数
    如果不指定类型, 默认是字符串, 如果 to 指定的变量以及存在则什么都不做

### set 设置变量, 或设置对象属性

`<set to='varname' [attr='attrname'] value='abc' [exp='false']/>`
*   设置 to 指定的属性的 attr 值为 value,
    如果 attr 未设置, 则直接修改 to 指定的变量的值
    如果 exp==true (默认false), 则从上下文中取数据
    修改系统变量会抛出异常

### del 删除变量/对象

`<del to='varname'/>`
*   删除上下文中的变量, 不会抛出异常, 但无法删除一些系统变量

### script 脚本

`<script src='/script1.js' [runat='server/client']/>`
*   如果 runat==server (默认是client)
    则运行一个服务端脚本, 相对于 /private/script 目录
    脚本运行在沙箱中, 能力受限

### pit 渲染标签体

`<pit/>`
*   在用户自定义标签库中, 渲染调用这个标签库时的标签体

### never 不会被渲染

`<never></never>`
*   不会进行任何处理的标签, 用于写注释

### !! 未完成的功能

`<error msg=''/>`
*   [未完成] 抛出一个异常, 并停止渲染

`<log msg='' [lv='info']/>`
*   [未完成] 记录日志, lv == info (默认), lv 可以是 debug/warn/error/info

`<plain src='/index.html'/>`
*   [未完成] 将文件作为普通文本输出到浏览器


# 开发者

> 下文是关于扩展程序时需要的知识, 深入定制模板才需要查看.


## 上下文中的对象

> 这些对象可以通过 bird 表达式引用, 比如要引用 `context.query.id` 则使用表达式 `###qeury.id###`; 如果要获取请求头中的信息使用 `###getHeader('Context-Type')###`.

```js
context: { // [r155]

[-- 在 http 中间件中有效的属性: --]
    nextId : Function()               -- 生成一个不重复的 ID
    session: Function()               -- 返回与客户端绑定的数据
    query  : Object                   -- Http 请求参数
    builder: html_builder             -- 生成 html 代码的对象见 base.js
    expression: expression_complier   -- 编译并解析表达式的方法 (过时, 使用 parse)
    parse  : Function(String)         -- 编译一个字符串(其中可以有表达式), 返回的对象有 val(context) 可以取得结果
    baseurl: String                   -- 中间件解析器根路径
    filepool: Object                  -- 系统文件池

    setHeader: function(name, value)  -- 设置 HTTP 应答头域的值
    getHeader: function(name)         -- 取得 HTTP 请求头域的值
    getVmContext: function()
    log : function(...)               -- 写日志
    config : {}                       -- 读取运行时配置, runtime_cfg

[-- 只在当前标签范围中有效的属性: [r175]--]
    tag_scope: {
        controler: {
            disable_sub()             -- 不渲染签体中的元素
            enable_sub()              -- (默认) 渲染标签体中的元素
        }        

        body: [ Buffer1, Buffer2 ... BufferN ]
                                      -- 标签体中静态文字的缓冲对象, 允许修改
                                      -- buffer 中的数据, 但修改 body 本身无效

        attr: Object                  -- 标签中的属性
        attr_str: String              -- 标签属性原始字符串
        name: String                  -- 标签名
        selfend: bool                 -- 自结束标签为 true
    }
}
```

## 渲染器函数定义

> 渲染器在不同的模块中有不同的定义
> 除了附加在后面的参数, 之前的参数的意义总是相同的


### 基础渲染器:

`function(next, buf, context)`

next    -- 渲染器中必须调用 next() 通知下一个渲染器开始渲染, next之后的代码无效
buf     -- 必须有 write 方法的对象, 可以通过 string_buf 创建
context -- 上下文对象, 由初始渲染器创建

> 基础渲染器的所有参数都不允许空, next 必须被调用, 否则后面的元素都不会渲染


### 模板渲染器:

`function(next, buf, context, tag_over)`

tag_over -- (其他参数同上) 自闭和的标签这个参数为空, 否则当内容全部渲染完成后
         -- 通过该方法注册的函数被调用

注册回调函数:

`tag_over(function() { /* 当标签体渲染完成, 这里会被回调 */ })`


> tag_over 的调用必须在 next 被调用之前完成, 否则不保证结果正确


## 插件

```js
//
// 创建中间件对象
//
var mid = mas.mid('/www');

//
// 在加入应用前,
// 添加插件实现复杂标签, 如果出错会抛出异常
// 客户端可以忽略这个异常, 则这个插件不会加载
//
mid.add_plugin( plugin_info: { name: '标签名', func: plugin_function } );

//
// 插件对象的渲染函数,
// taginfo 在 r175:tag_scope 中有说明,
// 当一个模板在编译时, 标签被声明, 这个函数被调用, 进行初始化的操作,
// 所有费时的操作都应该在初始化时完成, 如解析标签(动态)属性
//
function plugin_function(taginfo, userTagFactory, errorHandle, filename) {

    //
    // 必须返回一个渲染器函数, 当模板被渲染时, 这个函数被调用
    // 渲染器可以是异步执行, 最后必须调用 next
    //
    return function(next, buf, context, tag_over) {
        // next     -- 当这个标签渲染完成, 必须调用这个方法
        // buf      -- 是一个缓冲区对象, 可以用 .write() 写出字符串
        // context  -- 上下文对象见 r155

        // tag_over -- 自结束标签为空, 调用该方法注册一个回调函数
        // 当标签体中的标签也渲染完成时, 这个回调函数会被调用
        // 回调函数声明: function() { return 'stop'; }
        // 返回 stop 是可选的, 如果返回, 渲染会被终止! 当需要修改
        // 默认的渲染流程时会用到这个特性, 比如 for 循环的实现
    }
}
```

> 插件的实现, 可以参考 lib/systag/*.js 中系统插件的实现方式
