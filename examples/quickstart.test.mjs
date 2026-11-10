import assert from "node:assert/strict";
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
