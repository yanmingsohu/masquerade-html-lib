//
// <never/>
//
module.exports = function(taginfo) {

  return function(next, buf, context, tag_over) {
    context.tag_scope.controler.disable_sub();
    next();
  };
};
