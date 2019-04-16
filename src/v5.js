const WDIOReporter = require('@wdio/reporter').default;
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

function P(f, ...args) {
    return new Promise((resolve, reject) => {
        f(...args, (err, res) => (err ? reject(err) : resolve(res)));
    });
}

class JsonTreeReporter extends WDIOReporter {
    constructor (options = {}) {
        options = Object.assign(options, { logFilePrefix: path.join(process.cwd(), 'json-tree-reports') + '/' });
        super(options);

        Object.defineProperty(this, 'isSynchronised', { value: false, writable: true });
        this.config = {};
        this.runner = {};
        this.suites = [];
    }

    onRunnerStart(runner) {
        this.config = runner.config;
        this.runner = {
            type: 'runner',
            cid: runner.cid,
            sessionID: runner.sessionId,
            suites: [],
            retry: runner.retry,
        };
        this.suites.push(this.runner);
    }

    async onRunnerEnd() {
        let runner = this.formatRunner(this.runnerStat, this.runner, this.suites);

        let filename = this.options.logFilePrefix + runner.cid +
            (typeof runner.retry === 'number' && runner.retry ? '-' + runner.retry : '') + '.json';
        await P(mkdirp, path.dirname(filename));
        await P(fs.writeFile, filename, JSON.stringify(runner));
        await P(fs.writeFile, this.options.logFilePrefix + 'config.json', JSON.stringify(this.config));
        this.isSynchronised = true;
    }

    onSuiteStart(suite) {
        this.suites.push({
            type: 'suite',
            uid: suite.uid,
            suites: [],
            tests: [],
        });
        this.suites.slice(-2)[0].suites.push(this.suites.slice(-1)[0]);
    }

    onSuiteEnd(suite) {
        let idx = this.suites.findIndex(s => s.uid === suite.uid);
        if (idx >= 0) {
            this.suites.splice(idx, 1);
        }
    }

    onTestEnd(test) {
        this.suites.slice(-1)[0].tests.push({
            type: 'test',
            uid: test.uid,
        });
    }

    formatRunner(runnerStat, runner, suites) {
        runner = Object.assign({}, runner);

        let objs = {};
        function getobjs(obj) {
            ['suites', 'tests'].forEach(field =>
                Object.values(obj[field] || {}).forEach(f => (objs[f.uid] = f))
            );
            Object.values(obj.suites || {}).forEach(getobjs);
        }
        getobjs({ suites });

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
                obj.state = ['skipped', 'pending'].includes(objs[obj.uid].state) ? 'skip' :
                            ['passed'].includes(objs[obj.uid].state) ? 'pass' :
                            ['failed'].includes(objs[obj.uid].state) ? 'fail' :
                            objs[obj.uid].state;
                obj.error = objs[obj.uid].error;
            }
            [].concat(...['suites', 'tests'].map(f => obj[f] || [])).forEach(populate);
        }
        runner.start = runnerStat.start;
        runner.end = runnerStat.end;
        runner.duration = runnerStat._duration;
        runner.files = runnerStat.specs;
        runner.suites.forEach(populate);

        return runner;
    }
};

module.exports = { default: JsonTreeReporter };
