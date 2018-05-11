const request = require('requestretry')

const log = require('./log')

const TIMEOUT = 5000

/**
 * 修改url为以一个/结束
 * @param  {[type]} url [description]
 * @return {[type]}     [description]
 */
function normalizeUrl(url) {
	return url.replace(/\/*$/, '/')	// normalize
}

/**
 * 修改url为以一个/结束
 * @param  {[type]} url [description]
 * @return {[type]}     [description]
 */
function normalizeId(id) {
    return id.replace(/\//g, '%2f')	// normalize
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
					callback(null, null)
				} else if(doc.reason === 'Database does not exist.'){	// 数据库不存在
					callback(doc.error + ',' + doc.reason)
				} else {
					callback(null, doc)
				}
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
function setDocCallback(id, callback) {
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
		timeout: TIMEOUT, 
	    url: normalizeUrl(registry)+normalizeId(id)+'?revs=true'    // revs设为true貌似没啥卵用, revs_info
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
function createOrUpdateDoc(params, callback) {
	var {registry, id, newRev, newDoc} = params
	callback = callback || function(){}
	// 保存到库中
    // new_edits 如果发生冲突就会在文档中生成conlicts字段，理论上不会产生冲突，因为是单向同步且不会手动修改私有库数据
    // 对于同一个rev不能修改数据
    // rev由于new_edits设为了false，所以必须传rev
    // console.log(normalizeUrl(registry)+normalizeId(id) + '?new_edits=false&rev=' + newRev)
    var url = normalizeUrl(registry)+normalizeId(id)
    if(newRev){
    	url += '?new_edits=false&rev=' + newRev	// new_edits设为false，必须要传入一个well-formed且和库中不一样的rev才会更新或添加成功
    }    
    request.put({
		timeout: TIMEOUT, 
        url: url,
        json: newDoc
    }, setDocCallback(id ,function(error, result) {
		if(error){
			log.error(__line+':['+registry+']创建/修改文档['+id+']出错,'+error)
			callback(error)
		} else {
			log.info(__line+':['+registry+']创建/修改文档['+id+']成功')
			callback(null, result)
		}
	}))
    // fs.writeFile('b1.json', JSON.stringify(doc))
}

module.exports = {normalizeUrl, getDoc, createOrUpdateDoc, normalizeId}