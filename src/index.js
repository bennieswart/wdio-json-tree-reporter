const getparent = m => m.parent ? getparent(m.parent) : m;
const parent = getparent(module);
try {
    parent.require('@wdio/reporter');
    module.exports = require('./v5.js');
} catch (e) {
    module.exports = require('./v4.js');
}
