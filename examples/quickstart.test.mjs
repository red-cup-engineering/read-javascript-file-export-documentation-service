import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readJavascriptFileExportDocumentation } from "@red-cup-engineering/read-javascript-file-export-documentation-service";

test("JSDOC-QUICKSTART", () => {
  const text = `
    /** Convert minutes to seconds.
     * @param {number} minutes The minutes to convert.
     * @returns {number} Seconds.
     */
    export function seconds(minutes) { return minutes * 60; }
  `;
  const [entry] = readJavascriptFileExportDocumentation({
    type: "TextFileRead",
    path: "time.mjs",
    text,
  });
  assert.equal(entry.name, "seconds");
  assert.equal(entry.description, "Convert minutes to seconds.");
  assert.deepEqual(entry.parameters, [
    { name: "minutes", type: "number", description: "The minutes to convert." },
  ]);
  assert.deepEqual(entry.returns, { type: "number", description: "Seconds." });
});

test("JSDOC-INSTALLED-SOURCE", async () => {
  const specifier = "@red-cup-engineering/javascript-parser-service";
  const text = await readFile(new URL(import.meta.resolve(specifier)), "utf8");
  const entries = readJavascriptFileExportDocumentation({ type: "TextFileRead", path: specifier, text });
  const parse = entries.find(entry => entry.name === "parseJavaScript");
  assert.equal(parse?.kind, "function");
  assert.match(parse.signature, /^export function parseJavaScript\(text,/u);
  assert.ok(parse.description.length > 0);
  assert.ok(entries.some(entry => entry.name === "bindJavaScript" && entry.kind === "function"));
  assert.ok(entries.every(entry => entry.path === specifier));
});

test("JSDOC-EXPORT-BINDINGS", () => {
  const text = `
    /** Convert minutes to seconds.
     * @param {number} minutes The minutes to convert.
     * @returns {number} Seconds.
     */
    function seconds(minutes) { return minutes * 60; }
    export { seconds as convert };
    export default seconds;
    /** The foreign setting. */ export { setting } from "./unavailable.mjs";
    throw new Error("Documentation must not execute the supplied module");
  `;
  const entries = readJavascriptFileExportDocumentation({ type: "TextFileRead", path: "time.mjs", text });
  assert.deepEqual(entries.map(entry => [entry.name, entry.kind]), [
    ["convert", "function"], ["default", "function"], ["setting", "reexport"],
  ]);
  assert.equal(entries[0].signature, "function seconds(minutes)");
  assert.equal(entries[1].description, "Convert minutes to seconds.");
  assert.deepEqual(entries[2].reexport, { source: "./unavailable.mjs", imported: "setting" });
  assert.doesNotMatch(entries[2].signature, /function/u);
});
