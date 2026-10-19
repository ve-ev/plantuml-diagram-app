/**
 * Renders PlantUML source to SVG on the server, in the light or the dark theme. The diagram widget
 * calls it from the editor and stores both themes in its configuration, so viewing a diagram
 * renders nothing. The engine runs without Graphviz: graph layouts use Smetana.
 */

const {renderSvg} = require('./plantuml-engine');
const {parseError, toLines} = require('./lines');

// ponytail: a fixed bound against huge input; make it a setting if real diagrams hit it.
const MAX_SOURCE_LENGTH = 50000;

function render(source, dark) {
  const lines = toLines(source);
  // toLines may add a `@startuml` line; error line numbers must match what the author typed.
  const offset = lines.length > source.split(/\r\n|\r|\n/).length ? 1 : 0;
  const svg = renderSvg(lines, dark);
  const error = parseError(svg);
  if (error) {
    throw new Error(`Line ${error.line - offset}: ${error.message}`);
  }
  return svg;
}

exports.httpHandler = {
  endpoints: [
    {
      method: 'POST',
      path: 'svg',
      handle: ctx => {
        const {source, dark} = ctx.request.json();
        if (typeof source !== 'string' || !source.trim() || source.length > MAX_SOURCE_LENGTH) {
          ctx.response.code = 400;
          ctx.response.json({error: 'Invalid diagram source'});
          return;
        }
        try {
          ctx.response.json({svg: render(source, dark === true)});
        } catch (e) {
          ctx.response.json({error: e.message});
        }
      }
    }
  ]
};
