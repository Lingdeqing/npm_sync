const fs = require('fs')
const path = require('path')
const request = require('request')
const async = require('async')

const log = require('./log')

const {normalizeUrl, getDoc, createOrUpdateDoc, normalizeId} = require('./db_common.js')

/**
 * 同步tarball到指定数据库中
 * 同一个id的tarball要同时上传
 * @param  {[type]} id               [description]
 * @param  {[type]} tarballOriginUrl [description]
 * @param  {[type]} tarballRegistry  [description]
 * @return {[type]}                  [description]
 */
function syncTarball(id, tarballOriginUrl, tarballRegistry, TEMPDIR, callback) {

	callback = callback || function() {}
	tarballRegistry = normalizeUrl(tarballRegistry)

	var _getDoc = function(callback) {
		getDoc(tarballRegistry, id, function(error, doc) {
			if(error){
				log.error(__line+':获取tarball文档失败')
				callback(error)
			} else {
				callback(null, doc)
			}
		})
	}

	var _createDoc = function (doc, callback) {
		if(!doc){
			createOrUpdateDoc({registry: tarballRegistry, id: id, newRev: null, newDoc: {name: id}}, function (error, result) {
				if(error){
					callback(error)
				} else {
					callback(null, {existed: false, result: result})
				}
            })
		} else {
			callback(null, {existed: true, result: doc})
		}
	}

	var _uploadTarball = function (tempFile, tarballRegistry, id, tarballName, rev) {
		fs.createReadStream(tempFile).pipe(request.put({	// 上传附件
			url: tarballRegistry+normalizeId(id)+'/'+encodeURIComponent(tarballName),
			headers: {
				// 'Content-Type': 'application/x-compressed'
				'If-Match': rev // 必填
			}
		}, function (error, response, body) {
			if(error){
				log.error(__line+':上传附件失败,'+error)
				callback(error)
			} else {
				log.info(__line+':上传附件成功')
				callback(null)
			}
		}))
	}

	var _syncTarballDoc = function(error, result) {
		if(error){
			log.error(__line+':出错了,'+error)
			callback(error)
		} else {
			if(!result.result){
                log.error(__line+':result字段为空')
				callback('result字段为空')
			} else {
                var tarballName = tarballOriginUrl.replace(/.*\//, '')
                if(result.existed && result.result._attachments && result.result._attachments[tarballName] && result.result._attachments[tarballName].length !== 0){	// 附件已存在
                    log.info(__line+':本地库中已存在该附件')
                    callback(null, {existed: true})
                } else {	// 新创建的空文档或者附件不存在
					result = result.result
					var rev = result.rev || result._rev
					if(rev){

						createTempDir(TEMPDIR)	// 创建临时目录
						var tempFile = path.join(TEMPDIR, tarballName)
						if(fs.existsSync(tempFile)){	// 文件本地已存在，直接上传
							_uploadTarball(tempFile, tarballRegistry, id, tarballName, rev)
						} else {	// 否则重新下载上传
							request.get(tarballOriginUrl).pipe(fs.createWriteStream(tempFile))	// 下载文件
								.on('close', function (error) {
									if(error){
										log.error(__line+':下载附件失败,'+error)
										callback(error)
									} else {
										_uploadTarball(tempFile, tarballRegistry, id, tarballName, rev)
									}
								})
								.on('error', function(error) {
									log.error(__line+':下载附件失败,'+error)
									callback(error)
								})
						}


						
						/*request.get(tarballOriginUrl).pipe(request.put({
							url: tarballRegistry+id+'/'+encodeURIComponent(tarballName),
							headers: {
								// 'Content-Type': 'application/x-compressed'
								'If-Match': rev // 必填
							}
						}, function (error, response, body) {
							if(error){
								log.error(__line+':同步附件失败,'+error)
								callback(error)
							} else {
								log.info(__line+':同步附件成功')
								callback(null)
							}
						}))*/
					} else {
						log.error(__line+':没有rev字段')
						callback('没有rev字段')
					}
                }
			}
		}
	}

	var _syncTarball = function(error, result) {
		if(error){
			log.error(__line+':出错了,'+error)
			callback(error)
		} else {
			if(!result.result){
                log.error(__line+':result字段为空')
				callback('result字段为空')
			} else {
                var tarballName = tarballOriginUrl.replace(/.*\//, '')
                if(result.existed && result.result._attachments && result.result._attachments[tarballName] && result.result._attachments[tarballName].length !== 0){	// 附件已存在
                    log.info(__line+':本地库中已存在该附件')
                    callback(null, {existed: true})
                } else {	// 新创建的空文档或者附件不存在
					result = result.result
					var rev = result.rev || result._rev
					if(rev){

						createTempDir(TEMPDIR)	// 创建临时目录
						var tempFile = path.join(TEMPDIR, tarballName)
						if(fs.existsSync(tempFile)){	// 文件本地已存在，直接上传
							_uploadTarball(tempFile, tarballRegistry, id, tarballName, rev)
						} else {	// 否则重新下载上传
							request.get(tarballOriginUrl).pipe(fs.createWriteStream(tempFile))	// 下载文件
								.on('close', function (error) {
									if(error){
										log.error(__line+':下载附件失败,'+error)
										callback(error)
									} else {
										_uploadTarball(tempFile, tarballRegistry, id, tarballName, rev)
									}
								})
								.on('error', function(error) {
									log.error(__line+':下载附件失败,'+error)
									callback(error)
								})
						}


						
						/*request.get(tarballOriginUrl).pipe(request.put({
							url: tarballRegistry+id+'/'+encodeURIComponent(tarballName),
							headers: {
								// 'Content-Type': 'application/x-compressed'
								'If-Match': rev // 必填
							}
						}, function (error, response, body) {
							if(error){
								log.error(__line+':同步附件失败,'+error)
								callback(error)
							} else {
								log.info(__line+':同步附件成功')
								callback(null)
							}
						}))*/
					} else {
						log.error(__line+':没有rev字段')
						callback('没有rev字段')
					}
                }
			}
		}
	}

	async.waterfall([
			_getDoc,	// 获取文档
			_createDoc	// 如果没有对应id的文档，则创建对应id的文档
		], 
		_syncTarball	// 上传附件
	)
}

// syncTarball('shit15', 'https://registry.npmjs.org/jquery-ui/-/jquery-ui-1.12.0-beta.1.tgz', 'http://yaolin:123456@127.0.0.1:5984/tarball/')

/**
 * 创建临时目录
 * @param  {[type]} dir [description]
 * @return {[type]}     [description]
 */
function createTempDir(dir) {
	if(!fs.existsSync(dir)){
		fs.mkdirSync(dir)
	}
}

module.exports = {syncTarball}