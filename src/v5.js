const WDIOReporter = require('@wdio/reporter').default;
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

function P(f, ...args) {
    return new Promise((resolve, reject) => {
        f(...args, (err, res) => (err ? reject(err) : resolve(res)));
    });
}

function stateRollup(states) {
    states = [...(new Set(states))];
    return states.every(s => s === 'skip') ? 'skip' : states.some(s => s === 'fail') ? 'fail' : 'pass';
}

const stateRemap = {
    skipped: 'skip',
    pending: 'skip',
    passed: 'pass',
    failed: 'fail',
    retried: 'retry',
};

class JsonTreeReporter extends WDIOReporter {
    constructor (options = {}) {
        options = Object.assign(options, {
            outputFilePrefix: path.join(process.cwd(), 'json-tree-reports') + '/',
            reportPassedHooks: false,
        });
        super(options);

        Object.defineProperty(this, 'isSynchronised', { value: false, writable: true });
        this.suites = [];
    }

    onRunnerStart(runner) {
        this.suites.push({ suites: [] });
    }

    async onRunnerEnd(runner) {
        let output = {
            type: 'runner',
            cid: runner.cid,
            sessionID: runner.sessionId,
            suites: this.suites[0].suites,
            retry: runner.retry,
            start: runner.start,
            end: runner.end,
            duration: runner._duration,
            files: runner.specs,
            state: stateRollup(this.suites[0].suites.map(s => s.state)),
        };
        if (output.state === 'fail' && (output.retry || 0) < (runner.config.specFileRetries || 0)) {
            output.state = 'retry';
        }

        let filename = this.options.outputFilePrefix + output.cid +
            (typeof output.retry === 'number' && output.retry ? '-' + output.retry : '') + '.json';
        await P(mkdirp, path.dirname(filename));
        await P(fs.writeFile, filename, JSON.stringify(output));
        await P(fs.writeFile, this.options.outputFilePrefix + 'config.json', JSON.stringify(runner.config));
        this.isSynchronised = true;
    }

    onSuiteStart(suite) {
        this.suites.push({
            type: 'suite',
            uid: suite.uid,
            suites: [],
            tests: [],
            title: suite.title,
            start: suite.start,
        });
        this.suites.slice(-2)[0].suites.push(this.suites.slice(-1)[0]);
    }

    onSuiteEnd(suite) {
        let idx = this.suites.findIndex(s => s.uid === suite.uid);
        if (idx >= 0) {
            this.suites[idx].end = suite.end;
            this.suites[idx].duration = suite._duration;
            this.suites[idx].state =
                stateRollup([...this.suites[idx].suites, ...this.suites[idx].tests].map(i => i.state));
            this.suites.splice(idx, 1);
        }
    }

    _onTestEnd(test) {
        this.suites.slice(-1)[0].tests.push({
            type: 'test',
            uid: test.uid,
            title: test.title,
            start: test.start,
            end: test.end,
            duration: test._duration,
            state: stateRemap[test.state] || test.state,
            error: test.error,
        });
    }

    onTestPass() {
        this._onTestEnd(...arguments);
    }

    onTestFail() {
        this._onTestEnd(...arguments);
    }

    onTestSkip() {
        this._onTestEnd(...arguments);
    }

    onHookEnd(hook) {
        if (this.suites.length > 1 && (this.options.reportPassedHooks || (stateRemap[hook.state] || hook.state) === 'fail')) {
            this.suites.slice(-1)[0].tests.push({
                type: 'hook',
                uid: hook.uid,
                title: hook.title,
                start: hook.start,
                end: hook.end,
                duration: hook._duration,
                state: stateRemap[hook.state] || hook.state,
                error: hook.error,
            });
        }
    }
};

module.exports = { default: JsonTreeReporter };
