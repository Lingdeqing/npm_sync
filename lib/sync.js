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

const request = require('request')
const async = require('async')
const _ = require('lodash')

const log = require('./log')

/**
 * 修改url为以一个/结束
 * @param  {[type]} url [description]
 * @return {[type]}     [description]
 */
function normalizeUrl(url) {
	return url.replace(/\/*$/, '/')	// normalize
}

/**
 * 包装文档get请求响应函数
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function getDocCallback(callback) {
	return function(error, response, body) {
		if(error){
			callback(error)
		} else {
			try{
				var doc = JSON.parse(body)
				if(doc.error === 'not_found' && doc.reason === 'missing'){	// 判定为文档不存在
					doc = null
				}
				callback(null, doc)
			} catch(e){
				callback(e)
			}
		}
	}
}
/**
 * 包装文档set请求响应函数
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function setDocCallback(callback) {
	return function(error, response, body) {
		if(error){
			callback(error)
		} else {
			if(body.error){
				callback(body.error+','+body.reason)
			} else {
				callback(null, body)
			}
		}
	}
}

/**
 * 获取registry中对应id的文档
 * 
 * getDoc('https://registry.npmjs.org/', 'jquery-ui', callback)
 * 
 * @param  {[type]}   registry [description]
 * @param  {[type]}   id       [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function getDoc(registry, id, callback) {
	request.get({
	    url: normalizeUrl(registry)+encodeURIComponent(id)+'?revs=true'    // revs设为true貌似没啥卵用, revs_info
	}, getDocCallback(function(error, doc) {
		if(error){
			log.error(__line+':获取文档['+id+']失败,'+error)
			callback(error)
		} else {
			callback(null, doc)
		}
	}))
}

/**
 * 获取registry中对应id的文档rev字段
 * 
 * getDocRev('https://registry.npmjs.org/', 'jquery-ui', callback)
 * 
 * @param  {[type]}   registry [description]
 * @param  {[type]}   id       [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function getDocRev(registry, id, callback) {
	getDoc(registry, id, function (error, doc) {
		if(error){
			log.info(__line+':获取文档rev失败,'+error)
			callback(error)
		} else {
			callback(null, doc._rev)
		}
	})
}


/**
 * 创建或更新文档
 *
 *	createOrUpdateDoc('http://yaolin:123456@35.201.153.103:5984/test_attach/', 'jquery-ui', '10-431707a9073e6fada7ad686c06bd8809', {a:10, _rev: '10-431707a9073e6fada7ad686c06bd8809'})
 * 
 * @param  {[type]} registry [description]
 * @param  {[type]} id       [description]
 * @param  {[type]} newRev   [description]
 * @param  {[type]} doc      [description]
 * @return {[type]}          [description]
 */
function createOrUpdateDoc(registry, id, newRev, newDoc) {
	// 保存到库中
    // new_edits 如果发生冲突就会在文档中生成conlicts字段，理论上不会产生冲突，因为是单向同步且不会手动修改私有库数据
    // 对于同一个rev不能修改数据
    // rev由于new_edits设为了false，所以必须传rev
    // console.log(normalizeUrl(registry)+encodeURIComponent(id) + '?new_edits=false&rev=' + newRev)
    request.put({
        url: normalizeUrl(registry)+encodeURIComponent(id) + '?new_edits=false&rev=' + newRev,	// new_edits设为false，必须要传入一个well-formed且和库中不一样的rev才会更新或添加成功
        json: newDoc
    }, setDocCallback(function(error, result) {
		if(error){
			log.error(__line+':创建/修改文档['+id+']出错,'+error)
		} else {
			log.info(__line+':创建/修改文档['+id+']成功')
		}
	}))
    // fs.writeFile('b1.json', JSON.stringify(doc))
}

/**
 * 将localRegistry中对应id的文档同步为remoteRegistry中最新的文档
 * @param  {[type]} remoteRegistry [description]
 * @param  {[type]} localRegistry  [description]
 * @param  {[type]} id             [description]
 * @param  {[type]} localRev       [description]
 * @param  {[type]} remoteRev      [description]
 * @param  {[type]} options        [description]
 * @return {[type]}                [description]
 */
function _syncDocFromRomote(remoteRegistry, localRegistry, id, localRev, remoteRev, options) {

	request.get({
	    url: normalizeUrl(remoteRegistry) + encodeURIComponent(id) +'?revs=true'    // revs设为true貌似没啥卵用, revs_info
	}, getDocCallback(function (error, doc) {	    
		if(error){
			log.error(__line+':同步时获取远程文档失败,'+error)
		} else {
			_syncDocFromDoc(doc, localRegistry, id, remoteRev, options)
		}
	}))
}

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
function _syncDocFromDoc(newDoc, registry, id, newRev, options) {

	var flow = []
	if(options && options.editNpmJson){
		flow = flow.concat(options.editNpmJson)
	}

	flow.push(createOrUpdateDoc)
	async.applyEach(flow, registry, id, newRev, newDoc, options, function(error){
		if(error){
			log.error(__line+': 同步doc文档到本地数据库失败')
		} else {
			log.info(__line+': 同步doc文档到本地数据库成功')	
		}
	})
}

/**
 * 修改文档的tarball字段为指定的tarball字段
 * @param {[type]} registry [description]
 * @param {[type]} id       [description]
 * @param {[type]} newRev   [description]
 * @param {[type]} newDoc      [description]
 */
function setTarball(registry, id, newRev, newDoc, options){
	if(newDoc && newDoc.versions){
		for (var v in newDoc.versions) {
	        var version = newDoc.versions[v]
	        // version.dist = 'ggg'
	        // version.dist.tarball = 'eeee'
	        // version.dist.shasum = '8e223a9951ee37b119ac57a1714b441cf36aa070'
	        if(version && version.dist && version.dist.tarball){
		        var tarball = version.dist.tarball.replace(/.*\//, '')
		        if(tarball.endsWith('.tgz')){
		        	version.dist.tarball = options.TARBALL_DATABASE + encodeURIComponent(id)+'/'+tarball	
		        } else {
		        	log.warn(__line+': tarball格式好像有问题')
		        }
	        } else {
				log.warn(__line+': tarball字段不存在')
	        }
	        
	    }
	}
}

/**
 * 获取文档的版本号
 * dist-tags&versions文档 https://blog.csdn.net/liangklfang/article/details/68947786
 * @param doc
 * @param versionNum
 * @returns {*}
 */
function getVersionNum(doc, versionNum) {
    // 如果没有指定版本，则同步最新版本的依赖
    if(!versionNum){
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
function _syncDependencies(remoteRegistry, localRegistry, version, whichDependency = 'dependencies') {
    var dependencies = _.keys(version[whichDependency])
    if(dependencies.length > 0){
        async.each(dependencies, function (dependency) {
            syncDoc(remoteRegistry, localRegistry, dependency, null, {
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
function syncDependencies(remoteRegistry, localRegistry, doc, versionNum, options) {
    if(options.syncDependencies || options.syncDevDependencies){
        versionNum = getVersionNum(doc, versionNum)	// 获取版本号
        if(!versionNum){
            log.error(__line+':获取版本号失败')
        } else {
            if(doc.versions){
                var version = doc.versions[versionNum]
                if(version){
                    if(options.syncDependencies){	// 同步依赖
                        _syncDependencies(remoteRegistry, localRegistry, version)
                    }
                    if(options.syncDevDependencies){	// 同步开发依赖
                        _syncDependencies(remoteRegistry, localRegistry, version, 'devDependencies')
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

var hasSynced = {}
/**
 * 同步文档业务逻辑
 * @param  {[type]} remoteRegistry [description]
 * @param  {[type]} localRegistry  [description]
 * @param  {[type]} id             [description]
 * @param  {[type]} options        [description]
 * @return {[type]}                [description]
 */
function syncDoc(remoteRegistry, localRegistry, id, versionNum, options) {

	if(hasSynced[id]){
		return;
	}

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
		} else if(results.remote === null){	// 远程文档不存在
			log.error(__line+':远程库json文档不存在')
		} else {	// 同步文档或其依赖
	
			// _rev不等于远程库文档的_rev，同步文档
			if(results.local === null || results.remote._rev !== results.local._rev){
				_syncDocFromDoc(results.remote, localRegistry, id, results.remote._rev, {
					editNpmJson: [setTarball],
					TARBALL_DATABASE: 'http://35.201.153.103:5984/tarball/'
				})

				// 记录已经同步过的文档
	            hasSynced[id] = true
			} else {
				log.info(__line+': 远程库json文档和本地库的json文档相同')
			}

			// 同步依赖
            syncDependencies(remoteRegistry, localRegistry, results.remote, versionNum, options)
		} 
	})
}


// 默认同步依赖，不同步开发依赖
syncDoc('https://registry.npmjs.org/', 'http://yaolin:123456@127.0.0.1:5984/registry', 'express', null, {
    syncDependencies: true,
    syncDevDependencies: false
})

