# wdio-json-tree-reporter
A [wdio][wdio] reporter in json format with tests as a tree instead of flat

## Note
This reporter was developed to suite our in-house needs and therefor, though functional, it is very basic.
If you are interested in seeing additional features developed or bugs fixed, don't hesitate to submit an issue on github.

## Getting Started

Install this grunt plugin next to your project's [Gruntfile.js][getting_started] with:

```bash
npm install wdio-json-tree-reporter --save-dev
```

Then configure wdio to use the `json-tree` reporter with this line in `wdio.conf`:
```js
reporters: ['json-tree']
```

## License

Copyright Bennie Swart.
Licensed under the MIT license.

[wdio]: http://webdriver.io/guide/testrunner/gettingstarted.html
[getting_started]: http://gruntjs.com/getting-started
