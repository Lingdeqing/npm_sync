/*
    将已经同步成功的文档记录到lock文件中
 */
function Cache() {
    this._doc = {}
    this._tarball = {}
}

Cache.prototype = {
    /**
     * 判断某个id的文档是否同步过
     * @param id
     */
    hasSyncedDoc: function (id) {
        return this._doc[id]
    },
    /**
     * 标记某个id的文档已经同步过
     * @param id
     */
    markSyncedDoc: function (id, flag = true) {
        this._doc[id] = flag
    },
    /**
     * 判断某个id的文档是否同步过
     * @param id
     */
    hasSyncedTarball: function (id, versionNum) {
        return (this._tarball[id] && this._tarball[id][versionNum])
    },
    /**
     * 标记某个id的文档已经同步过
     * @param id
     */
    markSyncedTarball: function (id, versionNum, flag = true) {
        if(!this._tarball[id]){
            this._tarball[id] = {}
        }
        this._tarball[id][versionNum] = flag
    }
}

const cache = new Cache()
module.exports = cache
