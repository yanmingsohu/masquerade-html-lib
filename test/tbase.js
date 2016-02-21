var base = require('../index.js').base;
var tool = require('../index.js').tool;


var builder = base.html_builder(strbuf);


var render = 	
	builder.html( 
		builder.tag('div', builder.and(
			builder.tag('a',    builder.txt('hello')), 
			builder.tag('br/'                       ),
			builder.tag('span', builder.txt('world')) 
		)) 
	);

var strbuf = tool.string_buf();
var thecontext = { hello: 'world' };

tool.rendering(strbuf, thecontext, render, function(next, buf, context) {
	console.log("\nhtml:", buf.toString());
	console.log("context:", context);
});

