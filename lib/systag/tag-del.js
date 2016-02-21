var tool = require('../tool.js');


module.exports = function(taginfo) {

  if (!taginfo.selfend)
      throw new Error('must have no BODY');

  var to = taginfo.attr['to'];

  if (!to) 
      throw Error("must have 'to' attribute");


  return function(next, buf, context, tag_over) {
    if (!tool.isSystemVar(to)) {
      if (context[to])
        delete context[to];
      else
        tool.comment(buf, "delete var `", to, '` buf not exists');
    } else {
      tool.comment(buf, "cannot delete system var `", to, '`');
    }
    next();
  };
};
