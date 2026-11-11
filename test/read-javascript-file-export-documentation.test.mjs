import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readJavascriptFileExportDocumentation } from "../scripts/read-javascript-file-export-documentation.mjs";

const source = `/**
 * Adds two values.
 * @param {number} left The left value.
 * @param {number} right The right value.
 * @returns {number} Their sum.
 * @throws {TypeError} When either value is not numeric.
 */
export function add(left, right) { return left + right; }

function hidden() {}
`;

test("reads standard JSDoc from exported functions", () => {
  assert.deepEqual(readJavascriptFileExportDocumentation({ type: "TextFileRead", path: "scripts/add.mjs", text: source }), [{
    type: "JavascriptFileExportDocumentation",
    version: 1,
    path: "scripts/add.mjs",
    name: "add",
    kind: "function",
    signature: "export function add(left, right)",
    description: "Adds two values.",
    parameters: [
      { name: "left", type: "number", description: "The left value." },
      { name: "right", type: "number", description: "The right value." },
    ],
    returns: { type: "number", description: "Their sum." },
    throws: [{ type: "TypeError", description: "When either value is not numeric." }],
    tags: [],
  }]);
});

test("reads authored re-export documentation without inventing the foreign binding's kind", () => {
  const reexportSource = `import { add as addUpstream } from "./add-upstream.mjs";

/**
 * Adds two values.
 * @param {number} left The left value.
 * @param {number} right The right value.
 * @returns {number} Their sum.
 */
export { addUpstream as add };
`;
  assert.deepEqual(readJavascriptFileExportDocumentation({ type: "TextFileRead", path: "scripts/add.mjs", text: reexportSource }), [{
    type: "JavascriptFileExportDocumentation",
    version: 1,
    path: "scripts/add.mjs",
    name: "add",
    kind: "reexport",
    signature: "export { addUpstream as add }",
    reexport: { source: "./add-upstream.mjs", imported: "add" },
    description: "Adds two values.",
    parameters: [
      { name: "left", type: "number", description: "The left value." },
      { name: "right", type: "number", description: "The right value." },
    ],
    returns: { type: "number", description: "Their sum." },
    throws: [],
    tags: [],
  }]);
});

test("a constant or class re-export does not acquire a callable signature", () => {
  const entries = readJavascriptFileExportDocumentation({
    type: "TextFileRead", path: "index.mjs",
    text: `/** Public values. */ export { answer, Widget as WidgetClass } from "./values.mjs";`,
  });
  assert.deepEqual(entries.map(({ name, kind, signature, reexport }) => ({ name, kind, signature, reexport })), [
    { name: "answer", kind: "reexport", signature: 'export { answer } from "./values.mjs"', reexport: { source: "./values.mjs", imported: "answer" } },
    { name: "WidgetClass", kind: "reexport", signature: 'export { Widget as WidgetClass } from "./values.mjs"', reexport: { source: "./values.mjs", imported: "Widget" } },
  ]);
  assert.ok(entries.every(entry => entry.description === "Public values."));
});

test("local exports retain their declaration's documentation and real parameter syntax", () => {
  const entries = readJavascriptFileExportDocumentation({
    type: "TextFileRead", path: "index.mjs",
    text: `/** Pick the first value.
     * @param {string} [value] A value.
     * @returns {string} The chosen value.
     */
    function pick(value = "two  spaces", { fallback } = {}, ...rest) { return value; }
    const alias = pick;
    export { alias as select };
    const constant = 42;
    export { constant };
    `,
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "select");
  assert.equal(entries[0].kind, "function");
  assert.equal(entries[0].signature, 'function pick(value = "two  spaces", { fallback } = {}, ...rest)');
  assert.equal(entries[0].description, "Pick the first value.");
  assert.deepEqual(entries[0].parameters, [{ name: "value", type: "string", description: "A value.", optional: true }]);
});

test("export-site documentation overrides a local declaration without rewriting its signature", () => {
  const [entry] = readJavascriptFileExportDocumentation({
    type: "TextFileRead", path: "index.mjs",
    text: `/** Private wording. */ function original(value) { return value; }
    /** Public wording.
     * @returns {unknown} The value.
     */
    export { original as renamed };`,
  });
  assert.equal(entry.name, "renamed");
  assert.equal(entry.signature, "function original(value)");
  assert.equal(entry.description, "Public wording.");
  assert.deepEqual(entry.returns, { type: "unknown", description: "The value." });
});

test("default callable declarations, expressions and local aliases are documented", () => {
  for (const [text, signature] of [
    ["/** A callable. */ export default function named(value) { return value; }", "export default function named(value)"],
    ["/** A callable. */ export default function (value) { return value; }", "export default function (value)"],
    ["/** A callable. */ export default value => value;", "export default value =>"],
    ["/** A callable. */ const local = (value) => value; export default local;", "const local = (value) =>"],
  ]) {
    const [entry] = readJavascriptFileExportDocumentation({ type: "TextFileRead", path: "index.mjs", text });
    assert.equal(entry?.name, "default");
    assert.equal(entry.kind, "function");
    assert.equal(entry.signature, signature);
    assert.equal(entry.description, "A callable.");
  }
});

test("default callable inline JSDoc is retained with export-site precedence", () => {
  for (const text of [
    'export default /** The inline callable. */ function (value) { return value; }',
    'export default /** The inline callable. */ value => value;',
    'export default /** The inline callable. */ (function (value) { return value; });',
    'export default /** The inline callable. */ ((value => value));',
  ]) {
    const read = source => readJavascriptFileExportDocumentation({ type: "TextFileRead", path: "index.mjs", text: source });
    assert.equal(read(text)[0].description, "The inline callable.");
    assert.equal(read('/** The exported contract. */ ' + text)[0].description, "The exported contract.");
  }
});

test("parenthesized callable expressions retain attached JSDoc without wrapper fragments in signatures", () => {
  for (const [text, signature] of [
    ['export default /** Before the wrapper. */ (value => value);', 'export default value =>'],
    ['export default /** Before the wrapper. */ (function (value) { return value; });', 'export default function (value)'],
    ['export const grouped = /** Before the wrapper. */ ((value) => value);', 'export const grouped = (value) =>'],
  ]) {
    const [entry] = readJavascriptFileExportDocumentation({ type: "TextFileRead", path: "index.mjs", text });
    assert.equal(entry.description, "Before the wrapper.");
    assert.equal(entry.signature, signature);
  }
  const [nearest] = readJavascriptFileExportDocumentation({
    type: "TextFileRead", path: "index.mjs",
    text: 'export default /** Outer. */ (/** Nearest. */ (value => value));',
  });
  assert.equal(nearest.description, "Nearest.");
});

test("concise arrow signatures stop at their own arrow before parenthesized bodies", () => {
  for (const [text, signature] of [
    ['/** Creates an object. */ export const object = value => ({ value });', 'export const object = value =>'],
    ['/** Creates an object. */ export default value => ({ value });', 'export default value =>'],
    ['/** Creates an object. */ export const nested = (make = () => 1) => ({ value: make() });', 'export const nested = (make = () => 1) =>'],
    ['/** Creates a callback. */ export const factory = value => (next => value + next);', 'export const factory = value =>'],
  ]) {
    const [entry] = readJavascriptFileExportDocumentation({ type: "TextFileRead", path: "index.mjs", text });
    assert.equal(entry.signature, signature);
  }
});

test("multiple declarators have separate signatures without another function's implementation", () => {
  const entries = readJavascriptFileExportDocumentation({
    type: "TextFileRead", path: "index.mjs",
    text: `/** Converts a number. */ export const up = value => value + 1, down = function subtract(value) { return value - 1; };`,
  });
  assert.deepEqual(entries.map(entry => entry.signature), ["export const up = value =>", "export const down = function subtract(value)"]);
});

test("non-callable locals, cyclic aliases and export-star do not fabricate function records", () => {
  const entries = readJavascriptFileExportDocumentation({
    type: "TextFileRead", path: "index.mjs",
    text: `const answer = 42;
    class Widget {}
    const left = right, right = left;
    const dynamic = makeFunction();
    export { answer, Widget, left, dynamic };
    export * from "./unknown.mjs";`,
  });
  assert.deepEqual(entries, []);
});

test("an imported binding keeps its external origin through an immutable alias", () => {
  const [entry] = readJavascriptFileExportDocumentation({
    type: "TextFileRead", path: "index.mjs",
    text: `import original from "./foreign.mjs";
    /** The foreign default. */ const alias = original;
    export default alias;`,
  });
  assert.equal(entry?.name, "default");
  assert.equal(entry.kind, "reexport");
  assert.equal(entry.signature, "export default alias");
  assert.equal(entry.description, "The foreign default.");
  assert.deepEqual(entry.reexport, { source: "./foreign.mjs", imported: "default" });
});

test("namespace and quoted-name re-exports retain public names and remain unresolved", () => {
  const entries = readJavascriptFileExportDocumentation({
    type: "TextFileRead", path: "index.mjs",
    text: `/** The namespace. */ export * as namespace from "./foreign.mjs";
    export { value as "public-name" } from "./foreign.mjs";`,
  });
  assert.deepEqual(entries.map(({ name, kind, reexport }) => ({ name, kind, reexport })), [
    { name: "namespace", kind: "reexport", reexport: { source: "./foreign.mjs", imported: "*" } },
    { name: "public-name", kind: "reexport", reexport: { source: "./foreign.mjs", imported: "value" } },
  ]);
  assert.equal(entries[0].signature, 'export * as namespace from "./foreign.mjs"');
  assert.equal(entries[1].signature, 'export { value as "public-name" } from "./foreign.mjs"');
  assert.ok(Object.isFrozen(entries));
  assert.ok(entries.every(entry => Object.isFrozen(entry) && Object.isFrozen(entry.reexport)));
});

test("binding lookup respects module scope and per-declarator comments", () => {
  const entries = readJavascriptFileExportDocumentation({
    type: "TextFileRead", path: "index.mjs",
    text: `/** The outer callable. */ function outer(value) { return value; }
    function privateScope() { const outer = 42; return outer; }
    export { outer as publicName };
    /** First. */ export const first = () => 1,
      /** Second. */ second = () => 2;`,
  });
  assert.deepEqual(entries.map(entry => [entry.name, entry.description]), [
    ["publicName", "The outer callable."], ["first", "First."], ["second", "Second."],
  ]);
  assert.equal(entries[2].signature, "export const second = () =>");
});

test("the command face accepts and emits NDJSON records", () => {
  const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/read-javascript-file-export-documentation.mjs", import.meta.url))], {
    input: `${JSON.stringify({ type: "TextFileRead", path: "scripts/add.mjs", text: source })}\n`,
    encoding: "utf8",
  });
  assert.equal(command.status, 0, command.stderr);
  assert.deepEqual(JSON.parse(command.stdout), readJavascriptFileExportDocumentation({ type: "TextFileRead", path: "scripts/add.mjs", text: source })[0]);
});

test("refuses invalid carriers and invalid JavaScript", () => {
  assert.throws(() => readJavascriptFileExportDocumentation({ path: "x.mjs", text: "" }), /TextFileRead/u);
  assert.throws(() => readJavascriptFileExportDocumentation({ type: "TextFileRead", path: "x.mjs", text: "export function {" }), SyntaxError);
});
