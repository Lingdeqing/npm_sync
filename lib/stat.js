/**
 * 打印统计信息
 */

const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const _ = require('lodash')

const stat = {
	successDoc: 0,
	failedDoc: 0,
	existedDoc: 0,

	success: function(str){
		console.log(chalk.green(str))
	},
	failed: function(str){
		console.log(chalk.red(str))
	},
	warn: function(str){
		console.log(chalk.yellow(str))
	},
	syncDocSuccess: function(id){
		this.success(`同步json文档成功, [${id}]`)
		this.successDoc ++
	},
	syncDocFailed: function(id, error){
		this.failed(`同步json文档失败, [${id}],原因(${error})`)
		this.failedDoc ++
	},
	syncDocExist: function(id){
		this.warn(`同步json文档已存在, [${id}]`)
		this.existedDoc ++
	},
	syncTarballCached: function(id, versionRange){
		// this.warn(`缓存文件标记tarball已同步, [${id}][${versionRange}]`)
	},
	syncTarballFailed: function(id, versionRange, error){
		this.failed(`同步tarball失败, [${id}][${versionRange}],原因(${error})`)
	},
	syncTarballSuccess: function(id, versionRange){
		this.success(`同步tarball成功, [${id}][${versionRange}]`)
	},
	stat: function(){
		this.success(`\n添加成功文档${this.successDoc + this.existedDoc}个，其中`)
        this.successDoc && this.success(`\t新增到本地库中的文档${this.successDoc}个`)
        this.existedDoc && this.success(`\t本地库中已存在的文档${this.existedDoc}个`)
        this.failedDoc && this.failed(`添加失败文档${this.failedDoc}个`)
	}
}

module.exports = stat

 process.on('exit', function () {
     stat.stat()
 }).on('SIGINT', function () {
     process.exit()
 })
