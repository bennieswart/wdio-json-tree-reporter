const events = require('events');

Object.values = Object.values || (obj => Object.keys(obj).map(k => obj[k]));

class JsonTreeReporter extends events.EventEmitter {
    constructor (baseReporter, config, options = {}) {
        super();

        let runners = {};
        let suites = {};

        this.on('end', () => {
            let stats = baseReporter.stats;
            Object.keys(runners).forEach(cid => {
                let specs = stats.runners[cid].specs;
                runners[cid].specs = Object.keys(specs).map(spec => ({
                    specHash: spec,
                    suites: runners[cid].suites.filter(suite => suite.uid in specs[spec].suites),
                }));
                runners[cid].sessionID = stats.runners[cid].sessionID;
                delete runners[cid].suites;
            });
            
            let objs = {};
            function getobjs(obj) {
                ['suites', 'tests'].forEach(field =>
                    Object.values(obj[field] || {}).forEach(f => (objs[f.uid] = f))
                );
                Object.values(obj.suites || {}).forEach(getobjs);
            }
            Object.values(stats.runners).forEach(r => Object.values(r.specs).forEach(getobjs));

            function populate(obj) {
                if (obj.type === 'suite') {
                    obj.title = objs[obj.uid].title;
                    obj.start = objs[obj.uid].start;
                    obj.end = objs[obj.uid].end;
                    obj.duration = objs[obj.uid]._duration;
                } else if (obj.type === 'test') {
                    obj.title = objs[obj.uid].title;
                    obj.start = objs[obj.uid].start;
                    obj.end = objs[obj.uid].end;
                    obj.duration = objs[obj.uid]._duration;
                    obj.state = objs[obj.uid].state === 'pending' ? 'skip' : objs[obj.uid].state;
                    obj.error = objs[obj.uid].error;
                }
                [].concat(...['suites', 'tests'].map(f => obj[f] || [])).forEach(populate);
            }
            Object.values(runners).forEach(r => {
                let runner = stats.runners[r.cid];
                r.start = runner.start;
                r.end = runner.end;
                r.duration = runner._duration;
                r.specs.forEach(s => {
                    let spec = runner.specs[s.specHash];
                    s.start = spec.start;
                    s.end = spec.end;
                    s.duration = spec._duration;
                    s.files = spec.files;
                    s.suites.forEach(populate);
                });
            });

            let results = {
                config: config,
                runners: runners,
            };

            process.stdout._handle.setBlocking(true);
            process.stdout.write(JSON.stringify(results));
            process.stdout.write('\n\n');
            process.stdout._handle.setBlocking(false);
        });

        this.on('runner:start', runner => {
            runners[runner.cid] = {
                type: 'runner',
                cid: runner.cid,
                suites: [],
            };
            suites[runner.cid] = [runners[runner.cid]];
        });

        this.on('suite:start', suite => {
            suites[suite.cid].push({
                type: 'suite',
                uid: suite.uid,
                suites: [],
                tests: [],
            });
            suites[suite.cid].slice(-2)[0].suites.push(suites[suite.cid].slice(-1)[0]);
        });

        this.on('suite:end', suite => {
            suites[suite.cid].splice(-1, 1);
        });

        let testend = test => suites[test.cid].slice(-1)[0].tests.push({
            type: 'test',
            uid: test.uid,
        });

        this.on('test:pending', test => {
            testend(test);
        });

        this.on('test:pass', test => {
            testend(test);
        });

        this.on('test:fail', test => {
            testend(test);
        });
    }
};

module.exports = JsonTreeReporter;

