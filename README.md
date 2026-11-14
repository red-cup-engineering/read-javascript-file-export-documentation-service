# read-javascript-file-export-documentation-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Reads standard JSDoc for exported JavaScript functions and named re-exports in
one `TextFileRead`. It uses the shared JavaScript parser and binding resolver;
the supplied module is never imported or executed.

## Quickstart

Pass a `TextFileRead` with a path and the JavaScript source to
`readJavascriptFileExportDocumentation`. The result lists documented exports
with their signatures and tags. See the [runnable example](examples/quickstart.test.mjs).

Run `pnpm install --frozen-lockfile`, then `npm test` and `npm run test:consumer`.

## Export records

`readJavascriptFileExportDocumentation(reading)` returns immutable
`JavascriptFileExportDocumentation` version 1 records in export order. Each
record identifies its input `path` and public export `name`, plus the authored
description, parameters, return value, thrown errors and remaining JSDoc tags.
Optional JSDoc parameters carry `optional: true`. These annotations describe the
author's contract; reading them does not establish that the implementation
satisfies it.

| Kind | Evidence available in the input | Signature and origin |
| --- | --- | --- |
| `function` | A function declaration, arrow or function initializer, including an immutable local alias | The actual callable declaration's header, without its body |
| `reexport` | An explicit foreign binding, including an imported local alias or namespace export | The authored export binding and `reexport: { source, imported }`; its runtime kind remains unresolved |

Direct named callables preserve their existing record shape. A local alias uses
its public name with the original declaration's signature, so a declaration
named `internal` exported as `publicName` remains traceable. Default callables
use `name: "default"`. JSDoc on an export takes precedence over JSDoc inherited
from its local declaration. Each callable in a multiple-declaration statement
has its own signature. Signatures preserve literal characters and can contain
newlines; render them as code without collapsing whitespace inside literals.

Earlier versions synthesized `export function name(...)` for every named
re-export, even when it was a constant or class. Consumers must now distinguish
`kind: "reexport"` before treating a record as a function. Its parameter and
return annotations are retained as authored prose, without asserting an
upstream callable shape that the input file cannot establish.

## Scope and package composition

This operation reads one file. It does not load foreign modules, enumerate
`export *` members, infer dynamically produced functions, or document local
constants and classes. An empty result means no supported declarations were
found in that input, rather than proof that a package has no public API.
Named namespace re-exports remain explicit `reexport` records with
`imported: "*"`. Package documentation should use the package's actual export
resolver to choose shipped modules, then compose these records with installed
entry-point verification and executed acceptance results.

The installed examples also read the real upstream parser's source through its
public package export. This checks the reader against its supplier's actual
JavaScript module as well as the small introductory example.

The parser is the existing `javascript-parser-service` package (owned within the
JavaScriptNode repository), not the retired JavaScriptNode parser facade. The
shipped quickstart is an explicit receiving obligation and reads that real
installed parser's exports as well as authored source. Native source/archive
checks do not certify the existing full frozen dependency lock or registry
issuance; those receiving gates remain separate.


## Current supplier receiving prerequisite

This development manifest selects the genuine current parser, Content, File and JSONL sources used by the unchanged documentation reader. Original source tests and the existing three public quickstart cases qualify these selected source artifacts; the authored installed receiving profile remains unchanged. The selection does not claim issued-registry availability, reconcile transitive historical manifests, satisfy a frozen lock, or change upstream approval and activation gates.
