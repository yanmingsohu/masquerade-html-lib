var tool = require('../tool.js');

//
// <stop></stop>
//
module.exports = function(taginfo) {

  if (!taginfo.selfend)
       throw new Error('must not have BODY');

  return function(next, buf, context, tag_over) {
    context.__end();
  };
};
