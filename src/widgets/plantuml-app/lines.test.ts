import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseError, toLines} from './lines.ts';

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
