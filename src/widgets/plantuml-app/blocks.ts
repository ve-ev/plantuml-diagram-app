/**
 * Converts between ```plantuml code blocks and PlantUML widget embeds in markdown text. Text inside
 * code blocks of other languages is copied unchanged, so examples in code stay intact.
 */

export const DIAGRAM_WIDGET = 'plantuml-app';

const FENCE = /^ {0,3}(?<marker>`{3,}|~{3,})\s*(?<info>\S*)/;

/** A code block ends with a line of the same fence character, at least as long as the opening one. */
function isClosing(line: string, marker: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= marker.length && trimmed === marker[0].repeat(trimmed.length);
}

/** Index of the line that closes the code block opened at `start`, or `lines.length`. */
function closingLine(lines: string[], start: number, marker: string): number {
  let end = start + 1;
  while (end < lines.length && !isClosing(lines[end], marker)) {
    end++;
  }
  return end;
}

type OnLine = (line: string) => string;
type OnBlock = (source: string, index: number) => string;

/** Calls `onLine` for each line outside code blocks, and `onBlock` for each ```plantuml block. */
function transform(text: string, onLine: OnLine, onBlock: OnBlock): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let index = 0;
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE.exec(lines[i])?.groups;
    if (!open) {
      out.push(onLine(lines[i]));
      continue;
    }
    const end = closingLine(lines, i, open.marker);
    if (open.info === 'plantuml' && end < lines.length) {
      // Trailing whitespace changes nothing in a diagram.
      out.push(onBlock(lines.slice(i + 1, end).map(line => line.trimEnd()).join('\n'), index++));
    } else {
      out.push(...lines.slice(i, end + 1));
    }
    i = end;
  }
  return out.join('\n');
}

/** Replaces each ```plantuml block with `replacement(source, index)`. */
export function replaceBlocks(text: string, replacement: OnBlock): string {
  return transform(text, line => line, replacement);
}

export function findBlocks(text: string): string[] {
  const sources: string[] = [];
  transform(text, line => line, source => {
    sources.push(source);
    return '';
  });
  return sources;
}

export function embedLine(appName: string, key: string, height: number): string {
  return `![](widget:${appName}:${DIAGRAM_WIDGET}:${key}){width=100% height=${height}px}`;
}

function embedPattern(appName: string): RegExp {
  const app = appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^!\\[\\]\\(widget:${app}:${DIAGRAM_WIDGET}:(?<key>[A-Za-z0-9]+)\\)(\\{[^}]*\\})?$`);
}

/**
 * Replaces each diagram widget that has its own line with a ```plantuml block of its source.
 * Returns the new text and the keys of the replaced widgets.
 */
export function restoreWidgets(
  text: string,
  appName: string,
  sources: Record<string, string>
): {text: string; keys: string[]} {
  const pattern = embedPattern(appName);
  const keys: string[] = [];
  const restored = transform(text, line => {
    const key = pattern.exec(line.trim())?.groups?.key;
    if (key === undefined || !(key in sources)) {
      return line;
    }
    keys.push(key);
    return ['```plantuml', sources[key], '```'].join('\n');
  }, source => ['```plantuml', source, '```'].join('\n'));
  return {text: restored, keys};
}
