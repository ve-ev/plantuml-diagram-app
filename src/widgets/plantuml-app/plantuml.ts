/**
 * Glue around the PlantUML engine (`@plantuml/core`). The engine files are copied into the
 * plantuml-app widget folder by vite.config.ts and loaded at runtime, not bundled. Other widgets
 * load them from that folder too. The engine loads on the first render: readers see the stored
 * SVG and never load it.
 */

import {diagramKey, parseError, splitLines, toLines} from './lines';

export type Rendered = {svg: string; svgDark: string};
/** The widget configuration, see settings.json. Diagrams saved by version 1.0 have no SVG. */
export type Settings = {source: string} & Partial<Rendered>;

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

/** Graphviz (`window.Viz`) must be there before the engine starts: without it, the engine uses Smetana. */
function loadGraphviz(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${ENGINE_DIR}viz-global.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Cannot load the PlantUML engine'));
    document.head.appendChild(script);
  });
}

let engine: Promise<Engine> | null = null;
const loadEngine = () => {
  engine ??= loadGraphviz().then(() => import(/* @vite-ignore */ `${ENGINE_DIR}plantuml.js`));
  return engine;
};

/**
 * Colors for the dark mode of the engine. Some of its dark defaults and the C4 colors, made for a
 * white background, have low contrast. These values give text a WCAG 2 contrast of 4.5:1 or more
 * and an APCA contrast of Lc 60 or more on the dark background and on the element fills. They come
 * first in the diagram, and C4 sets its colors with `?=`, so the colors that the author sets win.
 */
const DARK_COLORS = [
  'skinparam HeaderFontColor #BBBBBB',
  'skinparam FooterFontColor #BBBBBB',
  'skinparam ClassStereotypeFontColor #CCCCCC',
  // The activation bar is white; text drawn over it is white too.
  'skinparam SequenceLifeLineBackgroundColor #313139',
  '<style>',
  'timingDiagram {',
  '  concise {',
  '    BackGroundColor #4A4A4A',
  '  }',
  '}',
  '</style>',
  '!$ARROW_COLOR = "#BBBBBB"',
  '!$BOUNDARY_COLOR = "#CCCCCC"',
  '!$CONTAINER_BG_COLOR = "#2F72B8"',
  '!$EXTERNAL_PERSON_BG_COLOR = "#4A4A4A"',
  '!$EXTERNAL_SYSTEM_BG_COLOR = "#5E5E5E"',
  '!$EXTERNAL_CONTAINER_BG_COLOR = "#737373"'
];

let queue: Promise<unknown> = Promise.resolve();

/** The engine keeps shared state, so renders run one at a time. */
function renderNow(source: string, dark: boolean): Promise<string> {
  const next = queue.then(async () => {
    const {renderToString} = await loadEngine();
    const lines = toLines(source);
    // toLines may add a `@startuml` line; error line numbers must match what the author typed.
    let offset = lines.length > splitLines(source).length ? 1 : 0;
    if (dark) {
      lines.splice(lines.findIndex(line => line.trim().startsWith('@start')) + 1, 0, ...DARK_COLORS);
      offset += DARK_COLORS.length;
    }
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

// ponytail: lives as long as the widget page and is never trimmed; one page edits one diagram.
const renders = new Map<string, Promise<string>>();
const cacheKey = (source: string, dark: boolean) => `${dark ? 'dark' : 'light'}\n${diagramKey(source)}`;

/** Adds the SVG stored with a diagram, so that the diagram is not rendered again. */
export function remember(source: string, rendered: Rendered): void {
  renders.set(cacheKey(source, false), Promise.resolve(rendered.svg));
  renders.set(cacheKey(source, true), Promise.resolve(rendered.svgDark));
}

/** Renders each source and theme once. A failed render is not kept: the engine may fail to load. */
export function renderSvg(source: string, dark: boolean): Promise<string> {
  const key = cacheKey(source, dark);
  let render = renders.get(key);
  if (!render) {
    render = renderNow(source, dark);
    render.catch(() => renders.delete(key));
    renders.set(key, render);
  }
  return render;
}

export async function renderBoth(source: string): Promise<Rendered> {
  const [svg, svgDark] = await Promise.all([renderSvg(source, false), renderSvg(source, true)]);
  return {svg, svgDark};
}
