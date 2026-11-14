#!/usr/bin/env node
import { once } from "node:events";
import { parseLines, serializeLines } from "@red-cup-engineering/jsonl-engineering-services-section";
import { requireTextFileRead } from "@red-cup-engineering/computer-file-engineering-services-section/require-text-file-read";
import { bindJavaScript, jsdocOf, parseJavaScript, parseJsdoc, walkJavaScript } from "@red-cup-engineering/javascript-parser-service";

function documentation(block) {
  const parsed = block ? parseJsdoc(block.value) : { description: "", tags: [] };
  const parameters = [];
  const throws = [];
  const tags = [];
  let returns = null;
  for (const tag of parsed.tags) {
    if (tag.tag === "param" || tag.tag === "arg" || tag.tag === "argument") {
      parameters.push(Object.freeze({ name: tag.name, type: tag.type, description: tag.description,
        ...(tag.optional ? { optional: true } : {}),
      }));
    } else if (tag.tag === "returns" || tag.tag === "return") {
      returns = Object.freeze({ type: tag.type, description: tag.description });
    } else if (tag.tag === "throws" || tag.tag === "throw" || tag.tag === "exception") {
      throws.push(Object.freeze({ type: tag.type, description: tag.description }));
    } else {
      tags.push(Object.freeze({ name: tag.tag, text: tag.text ?? tag.description ?? "" }));
    }
  }
  return Object.freeze({
    description: parsed.description,
    parameters: Object.freeze(parameters),
    returns,
    throws: Object.freeze(throws),
    tags: Object.freeze(tags),
  });
}

const callable = node => node && ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type);
const exportedName = node => node.type === "Identifier" ? node.name : node.value;
const withoutTerminator = text => text.trim().replace(/;$/u, "");

function previousToken(program, position) {
  let low = 0, high = program.tokens.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (program.tokens[middle].end <= position) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

function callableHeaderEnd(program, node) {
  if (node.type !== "ArrowFunctionExpression") return node.body.start;
  for (let index = previousToken(program, node.body.start); index >= 0; index -= 1) {
    const token = program.tokens[index];
    if (token.start < node.start) break;
    if (token.value === "=>") return token.end;
  }
  throw new SyntaxError("Parsed arrow function has no arrow token");
}

function expressionBlock(program, node, from) {
  if (!node) return null;
  const attached = jsdocOf(program, node);
  if (attached) return attached;
  for (let index = previousToken(program, node.start); index >= 0; index -= 1) {
    const token = program.tokens[index];
    if (token.start < from || token.value !== "(") break;
    const block = jsdocOf(program, token);
    if (block) return block;
  }
  return null;
}

function record(path, name, resolved, signature, block) {
  return Object.freeze({
    type: "JavascriptFileExportDocumentation", version: 1, path, name,
    kind: resolved.kind, signature,
    ...(resolved.reexport ? { reexport: Object.freeze({ ...resolved.reexport }) } : {}),
    ...documentation(block),
  });
}

function fileBindings(program, text) {
  const { references } = bindJavaScript(program);
  const parents = new Map();
  const declarations = new Map();
  const blockOf = (...nodes) => nodes.filter(Boolean).map(node => jsdocOf(program, node)).find(Boolean) ?? null;
  walkJavaScript(program, (node, parent) => parents.set(node, parent));
  walkJavaScript(program, (node, parent) => {
    if (node.type === "FunctionDeclaration" && node.id) {
      const owner = parent?.type.startsWith("Export") ? parent : node;
      declarations.set(references.get(node.id), {
        kind: "function", signature: text.slice(owner.start, node.body.start).trim(),
        block: blockOf(node, owner),
      });
    } else if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
      const owner = parents.get(parent);
      const block = expressionBlock(program, node.init, node.id.end) ??
        blockOf(node, parent, owner?.type.startsWith("Export") ? owner : null);
      const declaration = callable(node.init) ? {
        kind: "function",
        signature: `${owner?.type === "ExportNamedDeclaration" ? "export " : ""}${parent.kind} ${text.slice(node.id.start, node.id.end)} = ${text.slice(node.init.start, callableHeaderEnd(program, node.init)).trim()}`,
        block,
      } : { initializer: node.init, variableKind: parent.kind, block };
      declarations.set(references.get(node.id), declaration);
    } else if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers) {
        declarations.set(references.get(specifier.local), {
          kind: "reexport", block: blockOf(node),
          reexport: {
            source: node.source.value,
            imported: specifier.type === "ImportDefaultSpecifier" ? "default"
              : specifier.type === "ImportNamespaceSpecifier" ? "*" : exportedName(specifier.imported),
          },
        });
      }
    }
  });
  const resolve = (identifier, seen = new Set()) => {
    const binding = references.get(identifier);
    if (!binding || seen.has(binding)) return null;
    const declared = declarations.get(binding);
    if (!declared) return null;
    if (declared.kind) return declared;
    if (declared.variableKind !== "const" || declared.initializer?.type !== "Identifier") return null;
    seen.add(binding);
    const original = resolve(declared.initializer, seen);
    return original ? { ...original, block: declared.block ?? original.block } : null;
  };
  return { resolve, blockOf };
}

function exportedDocumentation(statement, context) {
  const { program, text, path, resolve, blockOf } = context;
  const declaration = statement.declaration;
  if (statement.type === "ExportDefaultDeclaration") {
    const resolved = callable(declaration)
      ? { kind: "function", signature: `export default ${text.slice(declaration.start, callableHeaderEnd(program, declaration)).trim()}`, block: null }
      : declaration.type === "Identifier" ? resolve(declaration) : null;
    return resolved ? [record(path, "default", resolved,
      resolved.signature ?? withoutTerminator(text.slice(statement.start, statement.end)),
      blockOf(statement) ?? expressionBlock(program, declaration, statement.start) ?? resolved.block)] : [];
  }
  if (statement.type === "ExportAllDeclaration") {
    if (!statement.exported) return [];
    const resolved = { kind: "reexport", reexport: { source: statement.source.value, imported: "*" } };
    return [record(path, exportedName(statement.exported), resolved,
      withoutTerminator(text.slice(statement.start, statement.end)), blockOf(statement))];
  }
  if (statement.type !== "ExportNamedDeclaration") return [];
  if (declaration?.type === "FunctionDeclaration" && declaration.id) {
    const resolved = resolve(declaration.id);
    return resolved ? [record(path, declaration.id.name, resolved, resolved.signature, resolved.block)] : [];
  }
  if (declaration?.type === "VariableDeclaration") {
    return declaration.declarations.flatMap(declarator => {
      if (declarator.id.type !== "Identifier") return [];
      const resolved = resolve(declarator.id);
      return resolved ? [record(path, declarator.id.name, resolved,
        resolved.signature ?? `export ${declaration.kind} ${text.slice(declarator.start, declarator.end)}`,
        resolved.block)] : [];
    });
  }
  return statement.specifiers.flatMap(specifier => {
    const resolved = statement.source
      ? { kind: "reexport", reexport: { source: statement.source.value, imported: exportedName(specifier.local) } }
      : resolve(specifier.local);
    if (!resolved) return [];
    const signature = resolved.signature ?? `export { ${text.slice(specifier.start, specifier.end)} }` +
      (statement.source ? ` from ${withoutTerminator(text.slice(statement.source.start, statement.end))}` : "");
    return [record(path, exportedName(specifier.exported), resolved, signature,
      jsdocOf(program, statement) ?? resolved.block)];
  });
}

/**
 * Reads standard JSDoc for locally declared exported functions and named foreign re-exports.
 * Local aliases use their declaration's signature; foreign bindings retain their export syntax
 * and origin without a claim about their runtime kind. The source is parsed, never executed.
 *
 * @param {object} reading A TextFileRead carrying the JavaScript path and source text.
 * @returns {readonly object[]} Version 1 JavascriptFileExportDocumentation records with function or reexport kinds, in export order.
 * @throws {TypeError} When the input is not a TextFileRead carrier.
 * @throws {SyntaxError} When the carried JavaScript does not parse.
 */
export function readJavascriptFileExportDocumentation(reading) {
  const { path, text } = requireTextFileRead(reading);
  const program = parseJavaScript(text);
  const context = { program, text, path, ...fileBindings(program, text) };
  return Object.freeze(program.body.flatMap(statement => exportedDocumentation(statement, context)));
}

if (import.meta.main) {
  process.stdin.setEncoding("utf8");
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  const documentation = parseLines(text).flatMap(readJavascriptFileExportDocumentation);
  const output = serializeLines(documentation);
  if (!process.stdout.write(output)) await once(process.stdout, "drain");
}
