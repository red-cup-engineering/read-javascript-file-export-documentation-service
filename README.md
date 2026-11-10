# read-javascript-file-export-documentation-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Reads standard JSDoc attached to exported functions in one JavaScript text-file reading.

## Quickstart

Pass a `TextFileRead` with a path and the JavaScript source to
`readJavascriptFileExportDocumentation`. The result lists documented exports
with their signatures and tags. See the [runnable example](examples/quickstart.test.mjs)
and [public API](docs/API.md).

Run `pnpm install --frozen-lockfile`, then `npm test` and `npm run test:consumer`.
