# staledeps

[license:badge]: https://img.shields.io/github/license/pmmmwh/staledeps
[npm:latest]: https://www.npmjs.com/package/staledeps/v/latest
[npm:latest:badge]: https://img.shields.io/npm/v/staledeps/latest

[![License][license:badge]](./LICENSE)
[![Latest Version][npm:latest:badge]][npm:latest]

Find stale dependencies in the package.json file(s).

## Installation

```
npm install -g staledeps
```

Or simply using [npx](https://docs.npmjs.com/cli/v8/commands/npx), the package runner bundled with `npm`:

```
$ npx staledeps
```

_Note:_ `staledeps` requires Node.js >= 14.16.

## Usage

```
Usage: staledeps <path(s)> [options]

Options:
      --version    Show version number                                 [boolean]
  -h, --help       Show help                                           [boolean]
  -f, --full       Show full report (including non-stale dependencies)
                                                      [boolean] [default: false]
  -r, --registry   URL of registry to check against
                                         [default: "https://registry.npmjs.org"]
  -t, --threshold  Threshold to be determined as stale (see vercel/ms)
                                                                 [default: "2y"]

Examples:
  staledeps ./package.json  Find stale dependencies in the package.json file(s)
```
