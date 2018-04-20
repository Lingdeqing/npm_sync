const log = require('./log')
const fs = require('fs')
const _ = require('lodash')
/*
    将已经同步成功的文档记录到lock文件中
 */
function Cache(lock = 'cache.json') {
    this._lock = lock
    if(!fs.existsSync(this._lock)){
        this._json = {}
    } else {
        this._json = JSON.parse(fs.readFileSync(this._lock))
    }
    Cache._caches.push(this)
}

Cache._caches = []
Cache.save = function () {
    _.each(Cache._caches, function (cache) {
        cache.save()
    })
}

Cache.prototype = {
    /**
     * 判断某个id的文档是否同步过
     * @param id
     */
    hasSyncedDoc: function (id) {
        return this._json[id] && this._json[id].syncedDoc
    },
    /**
     * 标记某个id的文档已经同步过
     * @param id
     */
    markSyncedDoc: function (id, flag = true) {
        if(this._json[id]){
            this._json[id].syncedDoc = true
        } else {
            this._json[id] = {syncedDoc: true}
        }
    },
    save: function () {
        fs.writeFileSync(this._lock, JSON.stringify(this._json, null, 2),'utf-8')
    }
}

module.exports = Cache

 process.on('exit', function () {
     Cache.save()
 }).on('SIGINT', function () {
     log.warn('同步未完成，强制退出程序')
     process.exit()
 })
