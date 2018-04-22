#!/usr/bin/env node
const program = require('commander')
const fs = require('fs')
const _ = require('lodash')

const sync = require('../lib/sync')

program
    .version(require('../package.json').version)
    .usage('<packagename@version> [options]')
    .option('-d, --no-dependencies', '不同步依赖')
    .option('-dev, --devdependencies', '同步开发依赖')
    .option('-r, --remoteregistry', '远程库地址')
    .option('-l, --localregistry', '本地库地址')
    .option('-t, --tarballregistry', 'tarball库地址')
    .parse(process.argv);

if (program.args.length < 1) {
    program.outputHelp();
    process.exit(10);
}

if(fs.existsSync('npm_sync.json')){
    const config = JSON.parse(fs.readFileSync('npm_sync.json'), 'utf-8')
    _.defaults(program, config)
}

program.args.forEach(function (pack) {
    pack = pack.split('@')
    var id = pack[0]
    var version = pack[1] || null
    sync(program.remoteregistry, program.localregistry, program.tarballregistry, id, version, {
        syncDependencies: program.dependencies,
        syncDevDependencies: program.devdependencies
    })
})



