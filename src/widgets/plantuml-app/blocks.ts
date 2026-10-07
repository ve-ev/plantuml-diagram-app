/**
 * Finds ```plantuml code blocks in markdown text and replaces them. Blocks of other languages,
 * and blocks inside them, are copied unchanged, so examples in code stay intact.
 */

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

/**
 * Replaces each ```plantuml block with `replacement(source, index)`. Trailing whitespace is
 * removed from the source: it changes nothing in a diagram.
 */
export function replaceBlocks(text: string, replacement: (source: string, index: number) => string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let index = 0;
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE.exec(lines[i])?.groups;
    if (!open) {
      out.push(lines[i]);
      continue;
    }
    const end = closingLine(lines, i, open.marker);
    if (open.info === 'plantuml' && end < lines.length) {
      out.push(replacement(lines.slice(i + 1, end).map(line => line.trimEnd()).join('\n'), index++));
    } else {
      out.push(...lines.slice(i, end + 1));
    }
    i = end;
  }
  return out.join('\n');
}

export function findBlocks(text: string): string[] {
  const sources: string[] = [];
  replaceBlocks(text, source => {
    sources.push(source);
    return '';
  });
  return sources;
}
