#!/usr/bin/node

const fs = require('fs');
const path = require('path');

function P(f, ...args) {
    return new Promise((resolve, reject) => {
        f(...args, (err, res) => (err ? reject(err) : resolve(res)));
    });
}

function showUsage() {
    console.log(
        'Usage: ./' + __filename + ' <target>\n\n' +
        '  Where target is the reporter output directory for v5,\n' +
        '    or - to read from stdin for v4.'
    );
}

(async () => {
    if (process.argv.length !== 3) {
        showUsage();
        process.exit(1);
    } else if (process.argv[2] === '-') {
        let json = JSON.parse(fs.readFileSync(0, 'utf8'));
        Object.keys(json.runners).forEach(cid => {
            if (json.runners[cid].specs.length > 1) {
                throw Error(`Expected only one spec for cid ${cid}`);
            }
            ['suites', 'start', 'end', 'duration', 'files'].forEach(f => {
                json.runners[cid][f] = json.runners[cid].specs[0][f];
            });
            delete json.runners[cid].specs;
        });
        console.log(JSON.stringify(json));
    } else if ((await P(fs.lstat, process.argv[2])).isDirectory()) {
        let items = (await P(fs.readdir, process.argv[2])).filter(i => i.endsWith('.json'));
        let prefix = items.find(i => i.endsWith('config.json')).replace(/config\.json$/, '');
        let unknown = [];
        let parts = items.map(i => {
            if (i.startsWith(prefix)) {
                let part = i.substr(prefix.length).match(/^(config|\d+(-\d+){1,2})\.json$/);
                if (part) {
                    return part[1];
                }
            }
            unknown.push(i);
        }).sort();
        if (unknown.length) {
            throw Error('The following unknown files were found in the target directory: ' + unknown.join(', '));
        }
        let content = {};
        await Promise.all(parts.map(async part => {
            content[part] = JSON.parse(await P(fs.readFile, path.join(process.argv[2], prefix + part + '.json'), 'utf8'));
        }));
        console.log(JSON.stringify({
            config: content.config,
            runners: Object.assign({}, ...parts.filter(p => p !== 'config').map(p => ({ [p]: content[p] }))),
        }));
    } else {
        console.log(`Error: ${process.argv[2]} is not a directory.`);
        process.exit(1);
    }
})();
