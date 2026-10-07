/**
 * Glue around the PlantUML engine (`@plantuml/core`). The engine files are copied next to the
 * widget page by vite.config.ts and loaded at runtime, not bundled.
 */

import {parseError, toLines} from './lines';

type Engine = {
  renderToString: (
    lines: string[],
    onSuccess: (svg: string) => void,
    onError: (message: string) => void,
    // Undocumented in 1.2026.8, read by the engine: `dark`, `maxSvgSize`.
    options?: {dark?: boolean}
  ) => void;
};

// The widget page is `about:srcdoc`; YouTrack sets its base URL to the app files.
const engine: Promise<Engine> = import(/* @vite-ignore */ new URL('plantuml.js', document.baseURI).href);

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
