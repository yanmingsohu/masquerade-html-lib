var tool = require('../tool.js');
var SAVE_KEY = '_-_PIT0_BODY';

//
// <pit/>
//
module.exports = function(taginfo) {

  if (!taginfo.selfend)
       throw new Error('must not have BODY');

  return function(next, buf, context, tag_over) {
    if (context[SAVE_KEY]) {
      context[SAVE_KEY](next);
    } else {
      next();
    }
  };
};
