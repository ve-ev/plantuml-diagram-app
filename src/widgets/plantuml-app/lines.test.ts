import assert from 'node:assert/strict';
import {test} from 'node:test';
import {diagramKey, parseError, splitDiagrams, toLines} from './lines.ts';

test('wraps a bare diagram in @startuml / @enduml', () => {
  assert.deepEqual(toLines('A -> B\r\nB -> A'), ['@startuml', 'A -> B', 'B -> A', '@enduml']);
});

test('keeps an explicit @start… block, also after blank lines', () => {
  assert.deepEqual(toLines('\n  @startmindmap\n* root\n@endmindmap'), ['', '  @startmindmap', '* root', '@endmindmap']);
});

test('removes trailing whitespace pasted from a terminal', () => {
  assert.deepEqual(toLines(`@startmindmap${'                    '}\n* a \t\n@endmindmap`), ['@startmindmap', '* a', '@endmindmap']);
});

test('reads line and message from an error SVG', () => {
  const svg = '<svg><text fill="#33FF02">PlantUML version</text><text fill="#000000">[From textarea (line 3) ]</text>' +
    '<text fill="#33FF02">A -&gt; B</text><text x="1" fill="#FF0000" font-weight="bold"> Syntax Error? (Assumed diagram type: sequence)</text></svg>';
  assert.deepEqual(parseError(svg), {line: 3, message: 'Syntax Error? (Assumed diagram type: sequence)'});
});

test('returns null for a real diagram', () => {
  assert.equal(parseError('<svg><text fill="#000000">Alice</text></svg>'), null);
});

test('ignores line break style, trailing spaces and blank lines around the diagram', () => {
  assert.equal(diagramKey('\r\n\nA -> B  \r\nB -> A\t\n\n'), diagramKey('A -> B\nB -> A'));
});

test('keeps line breaks, blank lines and indentation inside the diagram', () => {
  assert.notEqual(diagramKey('A -> B\nB -> A'), diagramKey('A -> B B -> A'));
  assert.notEqual(diagramKey('note: a\n\nb'), diagramKey('note: a\nb'));
  assert.notEqual(diagramKey('* a\n  * b'), diagramKey('* a\n* b'));
});

test('splits a source into one part for each @start… diagram', () => {
  assert.deepEqual(splitDiagrams('\n@startuml\nA -> B\n@enduml\n\n@startmindmap\n* a\n@endmindmap\n'),
    ['@startuml\nA -> B\n@enduml', '@startmindmap\n* a\n@endmindmap']);
});

test('keeps a source with one diagram or without @start… as one part', () => {
  assert.deepEqual(splitDiagrams('A -> B\nB -> A'), ['A -> B\nB -> A']);
  assert.deepEqual(splitDiagrams('title x\n@startuml\nA -> B\n@enduml'), ['title x\n@startuml\nA -> B\n@enduml']);
});
