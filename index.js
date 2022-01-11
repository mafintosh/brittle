const { kMain, kBrittle } = require('./lib/symbols')
if (!global[kBrittle]) global[kBrittle] = require('./brittle.js')
module.exports = global[kBrittle]
module.exports.skip = global[kBrittle].skip
module.exports.solo = global[kBrittle].solo
module.exports.todo = global[kBrittle].todo
module.exports.configure = global[kBrittle].configure
module.exports.test = module.exports
module.exports[kMain] = global[kBrittle][kMain]
