/*
 * Builds dist/plantuml-engine.js: the PlantUML engine as one CommonJS module for the YouTrack
 * script runtime. Order: browser shim, themes, stdlib bundles (C4), engine. The engine's ES module
 * export is replaced with `exports.renderSvg`, which renders synchronously.
 */
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

const ENGINE_EXPORT = 'export{C as render,D as renderToString};';
const engine = read('node_modules/@plantuml/core/plantuml.js');
if (!engine.includes(ENGINE_EXPORT)) {
  throw new Error('Unknown @plantuml/core export format: update scripts/build-engine.mjs');
}

const stdlib = readdirSync(resolve(root, 'vendor/plantuml-stdlib')).
  filter(name => name.endsWith('.min.js')).
  map(name => read(`vendor/plantuml-stdlib/${name}`));

// Bounds one render; a normal diagram needs a few thousand timer callbacks.
const MAX_TIMER_STEPS = 10_000_000;

const api = `
exports.renderSvg = function (lines, dark) {
  var svg = null;
  var error = null;
  D(lines, function (s) { svg = s; }, function (m) { error = m; }, {dark: dark});
  globalThis.__plantumlDrainTimers(${MAX_TIMER_STEPS});
  if (error !== null) {
    throw new Error(error);
  }
  if (svg === null) {
    throw new Error('PlantUML render did not finish');
  }
  return svg;
};
`;

writeFileSync(resolve(root, 'dist/plantuml-engine.js'), [
  read('server/shim.js'),
  read('node_modules/@plantuml/core/themes.js'),
  ...stdlib,
  engine.replace(ENGINE_EXPORT, api)
].join('\n;\n'));
