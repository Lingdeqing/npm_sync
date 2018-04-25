/*
    将已经同步成功的文档记录到lock文件中
 */
function Cache() {
    this._doc = {}
    this._tarball = {}
}

Cache.prototype = {
    MAX_RETRY: 5,  //最多出错重试5次
    /**
     * 判断某个id的文档是否同步过
     * @param id
     */
    hasSyncedDoc: function (id) {
        return this._doc[id] && this._doc[id].synced
    },
    /**
     * 标记某个id的文档已经同步过
     * @param id
     */
    markSyncedDoc: function (id, flag = true) {
        if(!this._doc[id]){
            this._doc[id] = {retry: 0}
        }
        
        this.markSynced(this._doc[id], flag)
    },
    /**
     * 判断某个id的文档是否同步过
     * @param id
     */
    hasSyncedTarball: function (id, versionNum) {
        return (this._tarball[id] && this._tarball[id][versionNum] && this._tarball[id][versionNum].synced)
    },
    /**
     * 标记某个id的文档已经同步过
     * @param id
     */
    markSyncedTarball: function (id, versionNum, flag = true) {
        if(!this._tarball[id]){
            this._tarball[id] = {}
        }
        if(!this._tarball[id][versionNum]){
            this._tarball[id][versionNum] = {retry: 0}
        }

        this.markSynced(this._tarball[id][versionNum], flag)
    },

    markSynced: function(obj, flag) {
        obj.synced = flag
        if(!flag){
            obj.retry ++
            if(obj.retry >= this.MAX_RETRY){
                obj.synced = true
            }
        }
    }
}

const cache = new Cache()
module.exports = cache
