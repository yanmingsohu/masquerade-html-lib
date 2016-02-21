var t = this;

module.exports = function(h) {
  var msg = '<div>This is require test:: `' + h +"` ok !</div>";
  log.log(msg);
  write(msg);
  write('</br>')
	write(JSON.stringify(t));
  return "require() work"; 
}