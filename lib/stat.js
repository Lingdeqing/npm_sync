/**
 * 打印统计信息
 */

const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const _ = require('lodash')

const stat = {
	success: function(str){
		console.log(chalk.green(str))
	},
	failed: function(str){
		console.log(chalk.red(str))
	},
	warn: function(str){
		console.log(chalk.yellow(str))
	},
	syncDocSuccess: function(id, versionRange){
		this.success(`同步json文档成功, [${id}][${versionRange}]`)
	},
	syncDocFailed: function(id, versionRange, error){
		this.failed(`同步json文档失败, [${id}][${versionRange}],原因(${error})`)
	},
	syncDocCached: function(id, versionRange){
		this.warn(`缓存文件标记json文档已同步, [${id}][${versionRange}]`)
	},
	syncDocExist: function(id, versionRange){
		this.warn(`同步json文档已存在, [${id}][${versionRange}]`)
	},
	syncTarballCached: function(id, versionRange){
		this.warn(`缓存文件标记tarball已同步, [${id}][${versionRange}]`)
	},
	syncTarballFailed: function(id, versionRange, error){
		this.failed(`同步tarball失败, [${id}][${versionRange}],原因(${error})`)
	},
	syncTarballSuccess: function(id, versionRange){
		this.success(`同步tarball成功, [${id}][${versionRange}]`)
	},
	save: function(){
		// var tempalte = fs.readFileSync(path.join(__dirname, 'stat_template.html'), 'utf-8')
		// tempalte = _.template(tempalte)
		// fs.writeFileSync('./stat.html', tempalte(this._stat), 'utf-8')
	}
}

module.exports = stat

 process.on('exit', function () {
     stat.save()
 }).on('SIGINT', function () {
     process.exit()
 })
