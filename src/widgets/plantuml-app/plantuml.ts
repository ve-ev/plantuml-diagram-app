/**
 * Glue around the PlantUML engine (`@plantuml/core`). The engine files are copied into the
 * plantuml-app widget folder by vite.config.ts and loaded at runtime, not bundled. Other widgets
 * load them from that folder too.
 */

import {parseError, toLines} from './lines';

// The widget page is `about:srcdoc`; the host sets its base URL to the app files.
const ENGINE_DIR = new URL('../plantuml-app/', document.baseURI).href;

declare global {
  interface Window {
    PLANTUML_STDLIB_BASE?: string;
  }
}

// The engine loads themes.js and the stdlib bundles (c4.min.js) from this folder.
window.PLANTUML_STDLIB_BASE = ENGINE_DIR;

type Engine = {
  renderToString: (
    lines: string[],
    onSuccess: (svg: string) => void,
    onError: (message: string) => void,
    // Undocumented in 1.2026.8, read by the engine: `dark`, `maxSvgSize`.
    options?: {dark?: boolean}
  ) => void;
};

const engine: Promise<Engine> = import(/* @vite-ignore */ `${ENGINE_DIR}plantuml.js`);

let queue: Promise<unknown> = Promise.resolve();

/**
 * Renders the source to an SVG string. The engine keeps shared state, so renders run one at a time.
 */
export function renderSvg(source: string, dark: boolean): Promise<string> {
  const next = queue.then(async () => {
    const {renderToString} = await engine;
    const lines = toLines(source);
    // toLines may add a `@startuml` line; error line numbers must match what the author typed.
    const offset = lines.length > source.split(/\r\n|\r|\n/).length ? 1 : 0;
    const svg = await new Promise<string>((resolve, reject) => {
      renderToString(lines, resolve, message => reject(new Error(message)), {dark});
    });
    const error = parseError(svg);
    if (error) {
      throw new Error(`Line ${error.line - offset}: ${error.message}`);
    }
    return svg;
  });
  queue = next.catch(() => undefined);
  return next;
}
