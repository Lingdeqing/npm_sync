// 在windows中会报超时错误，可能是只有四个线程查询dns导致，设了还是没有用
// process.env.UV_THREADPOOL_SIZE = 128
// request.options
// pool: {
//     maxSockets: Infinity
// }

// 若指定版本,则同步指定版本tarball和最新版本tarball
// 同步逻辑
// 1.同步json文档
// 	获取本地库的json文件和远程库的json文档
//	若_rev不相等,则使用远程库的同步本地库的json文档
//		下载远程库的json文档,修改tarball路径,上传到本地库中
// 2.同步tarball
// 	获取tarball文档
// 	若没有,则新建
// 	若有
// 		查看对应的附件版本号是否存在
// 			若存在,则结束
// 			否则,从远程上传对应tarball到本地库对应文档的附件上
// 3.读取dependencies字段
// 	递归同步依赖

const request = require('requestretry')
const async = require('async')
const _ = require('lodash')
const semver = require('semver')
const fs = require('fs')
const path = require('path')

const log = require('./log')
const stat = require('./stat')
const cache = require('./cache')
const {normalizeUrl, getDoc, createOrUpdateDoc, normalizeId} = require('./db_common.js')
const {syncTarball} = require('./tarball.js')

// stat.silent()

/**
 * 从newDoc同步文档到数据库中
 * @param  {[type]} newDoc   [description]
 * @param  {[type]} registry [description]
 * @param  {[type]} id       [description]
 * @param  {[type]} localRev [description]
 * @param  {[type]} newRev   [description]
 * @param  {[type]} options  [description]
 * @return {[type]}          [description]
 */
function _syncDocFromDoc(newDoc, registry, id, newRev, TARBALL_DATABASE, callback) {
	async.applyEach([
		setTarball,
		createOrUpdateDoc
	], {registry:registry, id:id, newRev:newRev, newDoc:newDoc, TARBALL_DATABASE: TARBALL_DATABASE}, function(error) {
		callback && callback(error)
	})
}

/**
 * 修改文档的tarball字段为指定的tarball字段
 * @param {[type]} registry [description]
 * @param {[type]} id       [description]
 * @param {[type]} newRev   [description]
 * @param {[type]} newDoc      [description]
 */
function setTarball(params, callback){
	var {newDoc, TARBALL_DATABASE, id} = params
	if(newDoc && newDoc.versions){
		for (var v in newDoc.versions) {
	        var version = newDoc.versions[v]
	        // version.dist = 'ggg'
	        // version.dist.tarball = 'eeee'
	        // version.dist.shasum = '8e223a9951ee37b119ac57a1714b441cf36aa070'
	        if(version && version.dist && version.dist.tarball){
		        version.dist._tarballOriginUrl = version.dist.tarball 	// 保存原始的tarball url
		        var tarball = version.dist.tarball.replace(/.*\//, '')
		        if(tarball.endsWith('.tgz')){
		        	version.dist.tarball = TARBALL_DATABASE + normalizeId(id)+'/'+tarball
		        } else {
		        	log.warn(__line+': tarball格式好像有问题')
		        }
	        } else {
				log.warn(__line+': tarball字段不存在')
	        }

	    }
	}
	callback(null)
}

/**
 * 获取指定版本的tarball
 * @param  {[type]} doc        [description]
 * @param  {[type]} versionNum [description]
 * @return {[type]}            [description]
 */
function getTarball(doc, versionNum) {
	if(doc && doc.versions && doc.versions[versionNum] && doc.versions[versionNum].dist){
		return doc.versions[versionNum].dist._tarballOriginUrl || doc.versions[versionNum].dist.tarball
	}
}

/**
 * 获取文档的版本号
 * dist-tags&versions文档 https://blog.csdn.net/liangklfang/article/details/68947786
 * semver https://www.npmjs.com/package/semver https://blog.csdn.net/njweiyukun/article/details/70309066
 * @param doc
 * @param versionNum
 * @returns {*}
 */
var loog = ''
function getVersionNum(doc, versionRange) {
    // 如果没有指定版本，则同步最新版本的依赖
    var versionNum = null
    versionRange = semver.validRange(versionRange)
	if(semver.valid(versionRange)){	// '1.2.1'
		versionNum = versionRange
	} else if(versionRange) {	// '^1.2.1'
		var versionNums = _.keys(doc.versions)
		versionNum = semver.maxSatisfying(versionNums, versionRange)
	}
	if(!doc._rev){

        loog += '**************************\n'
        loog += JSON.stringify(doc)
        loog += '**************************\n'
	}

	// 若没有取到版本则使用最新版本
	if(!versionNum){
		log.info(__line+':未取到适合范围的版本号，使用最新版本号')
        var distTags = doc['dist-tags']

        if(distTags && distTags.latest){	// 如果dist-tags中有latest，则从dist-tags中取最新版本号
            versionNum = distTags.latest
        } else {	// 否则取versions数组的最后一个version。当然了，一般情况下dist-tags中肯定有latest字段
            versionNum = _.last(_.keys(doc.versions))
        }
    }

    return versionNum
}

/**
 * 同步依赖
 * @param doc
 * @param versionNum
 * @param whichDependency
 */
function _syncDependencies(remoteRegistry, localRegistry, TARBALL_DATABASE, TEMPDIR,  version, whichDependency = 'dependencies') {
    var dependencies = _.keys(version[whichDependency])
    if(dependencies.length > 0){
        async.each(dependencies, function (dependency) {
        	var dependencyVersionRange = version[whichDependency][dependency]
            syncDoc(remoteRegistry, localRegistry, TARBALL_DATABASE, TEMPDIR,  dependency, dependencyVersionRange, {
                syncDependencies: true,
                syncDevDependencies: false	// 不同步依赖的开发依赖
			})
        })
    }
}

/**
 * 递归同步依赖
 * 依照npm install的原理
 * 文档 https://www.zhihu.com/question/66629910
 * @param doc
 * @param options
 */
function syncDependencies(remoteRegistry, localRegistry, TARBALL_DATABASE, TEMPDIR, doc, versionNum, options) {
    if(options.syncDependencies || options.syncDevDependencies){
        if(!versionNum){
            log.error(__line+':获取版本号失败')
        } else {
            if(doc.versions){
                var version = doc.versions[versionNum]
                if(version){
                    if(options.syncDependencies){	// 同步依赖
                        _syncDependencies(remoteRegistry, localRegistry, TARBALL_DATABASE, TEMPDIR, version)
                    }
                    if(options.syncDevDependencies){	// 同步开发依赖
                        _syncDependencies(remoteRegistry, localRegistry, TARBALL_DATABASE, TEMPDIR, version, 'devDependencies')
                    }
                } else {
                    log.error(__line+':version不存在')
                }
            } else {
                log.error(__line+':versions字段不存在')
            }
        }
    }
}

/**
 * 同步文档业务逻辑
 * @param  {[type]} remoteRegistry [description]
 * @param  {[type]} localRegistry  [description]
 * @param  {[type]} id             [description]
 * @param  {[type]} options        [description]
 * @return {[type]}                [description]
 */
function syncDoc(remoteRegistry, localRegistry, TARBALL_DATABASE, TEMPDIR, id, versionRange, options) {

	async.parallel({
		remote: function(callback) {
			getDoc(remoteRegistry, id, callback)
		},
		local: function(callback) {
			getDoc(localRegistry, id, callback)
		}
	}, function(error, results) {
		if(error){
			log.error(__line+': 获取远程库['+id+']或本地库json文档['+id+']出错了')
			stat.syncDocFailed(id, error)
		} else if(results.remote === null){	// 远程文档不存在
			log.error(__line+':远程库json文档不存在')
			stat.syncDocFailed(id, '远程库json文档不存在')
		} else {
        	var versionNum = getVersionNum(results.remote, versionRange)	// 获取版本号

			// 1.同步文档
			// 缓存文件中标记此id的文档未同步
			if(!cache.hasSyncedDoc(id)){

				// 标记已经同步过的文档
				cache.markSyncedDoc(id)

				// 本地文档为空或者_rev不等于远程库文档的_rev，同步文档
				if(results.local === null || results.remote._rev !== results.local._rev){
					_syncDocFromDoc(results.remote, localRegistry, id, results.remote._rev,TARBALL_DATABASE, function(error) {
						if(error){
							cache.markSyncedDoc(id, false)	// 标记已经同步过的文档未同步成功，以便重新同步
							log.error(__line+':同步失败,'+error)
							stat.syncDocFailed(id, error)
						} else {
							log.info(__line+':同步成功')
							stat.syncDocSuccess(id)
						}
					})


				} else {
					log.info(__line+': 远程库json文档和本地库的json文档相同')
					stat.syncDocExist(id)
				}
			} else {
				log.info(__line+': 缓存文件标记已同步')
			}


			

            // 3.同步附件
            if(!cache.hasSyncedTarball(id, versionNum)){

            	// 2.同步依赖
            	syncDependencies(remoteRegistry, localRegistry, TARBALL_DATABASE, TEMPDIR, results.remote, versionNum, options)

            	// 标记已经同步过的文档
				cache.markSyncedTarball(id, versionNum)


				// 同步附件
				var tarballOriginUrl = getTarball(results.remote, versionNum)	// 获取附件源地址
				if(!tarballOriginUrl){
					log.error('未找到tarball源地址')
					stat.syncTarballFailed(id, versionNum, '未找到tarball源地址')

					// 标记已经同步过的文档
					cache.markSyncedTarball(id, versionNum, false)
				} else {
					syncTarball(id, tarballOriginUrl, TARBALL_DATABASE, TEMPDIR,  function(error, result) {
		            	if(error){
							stat.syncTarballFailed(id, versionNum, error)
							// 标记已经同步过的文档
							cache.markSyncedTarball(id, versionNum, false)
		            	} else if(result && result.existed){
							stat.syncTarballExist(id, versionNum)
		            	} else {
                            stat.syncTarballSuccess(id, versionNum)
						}
		            })
				}
            } else {
                log.info(__line+': 缓存文件标记tarball已同步')
            }
		}
	})
}

// 默认同步依赖，不同步开发依赖
// syncDoc('https://registry.npmjs.org/', 'http://yaolin:123456@35.201.153.103:5984/registry','http://127.0.0.1:5984/tarball/', 'express', null, {
//     syncDependencies: true,
//     syncDevDependencies: false
// })

module.exports = syncDoc

process.on('exit', function () {
	fs.writeFileSync('log.txt', loog)
})