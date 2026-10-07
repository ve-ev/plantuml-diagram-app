/**
 * Turns the text the author typed into the lines the engine renders.
 * As in GitLab, `@startuml` / `@enduml` are optional; any other `@start…` type is kept as is.
 * Trailing whitespace is removed: mindmaps keep it in node text, and text pasted from a terminal
 * pads every line to the window width.
 */
export function toLines(source: string): string[] {
  const lines = source.split(/\r\n|\r|\n/).map(line => line.trimEnd());
  const first = lines.find(line => line.trim() !== '')?.trim() ?? '';
  return first.startsWith('@start') ? lines : ['@startuml', ...lines, '@enduml'];
}

const ERROR_LINE = /\[From [^\]]*\(line (\d+)\)/;
const ERROR_TEXT = /<text[^>]*fill="#FF0000"[^>]*>([^<]*)<\/text>/g;

/**
 * The engine reports a syntax error as a normal SVG that draws the error. Reads the line number
 * and the message from that SVG, or returns null for a real diagram.
 */
export function parseError(svg: string): {line: number; message: string} | null {
  const line = ERROR_LINE.exec(svg);
  if (!line) {
    return null;
  }
  const message = [...svg.matchAll(ERROR_TEXT)].
    map(m => m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()).
    join(' ');
  return {line: Number(line[1]), message: message || 'Syntax error'};
}
