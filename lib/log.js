// const _ = require('lodash')
const fs = require('fs')
const Log = require('log')

Object.defineProperty(global, '__stack', {
	get: function(){
		var orig = Error.prepareStackTrace;
		Error.prepareStackTrace = function(_, stack){ return stack; };
		var err = new Error;
		Error.captureStackTrace(err, arguments.callee);
		var stack = err.stack;
		Error.prepareStackTrace = orig;
		return stack;
	}
})
Object.defineProperty(global, '__line', {
	get: function(){
		return __stack[1].getLineNumber();
	}
})
if(!fs.existsSync('./log')){
	fs.mkdirSync('./log')
}
module.exports = new Log('info', fs.createWriteStream('./log/'+String(new Date()).replace(/\s|:/g, '_').slice(0, -21)+'.log'));
