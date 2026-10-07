import assert from 'node:assert/strict';
import {test} from 'node:test';
import {embedLine, findBlocks, replaceBlocks, restoreWidgets} from './blocks.ts';

const HEIGHT = 120;

const TEXT = [
  'Intro',
  '```plantuml',
  'A -> B : привет   ',
  'B --> A',
  '```',
  '```js',
  '// not a diagram',
  '```',
  'End'
].join('\n');

test('finds only ```plantuml blocks, without trailing whitespace', () => {
  assert.deepEqual(findBlocks(TEXT), ['A -> B : привет\nB --> A']);
});

test('replaces each block with one line and keeps the other text', () => {
  assert.equal(
    replaceBlocks(TEXT, (source, index) => `[${index}:${source}]`),
    ['Intro', '[0:A -> B : привет\nB --> A]', '```js', '// not a diagram', '```', 'End'].join('\n')
  );
});

test('does not touch blocks inside other code blocks', () => {
  const text = ['````md', '```plantuml', 'A -> B', '```', '````'].join('\n');
  assert.deepEqual(findBlocks(text), []);
  assert.equal(replaceBlocks(text, () => 'X'), text);
});

test('keeps an unclosed block as text', () => {
  assert.deepEqual(findBlocks(['```plantuml', 'A -> B'].join('\n')), []);
});

test('restores own widget lines as code blocks and keeps other text', () => {
  const text = [
    'Intro',
    embedLine('plantuml-diagrams', 'abc', HEIGHT),
    '![](widget:other-app:plantuml-app:xyz){width=100% height=100px}',
    'Inline ![](widget:plantuml-diagrams:plantuml-app:def){width=1 height=1} stays',
    '```md',
    embedLine('plantuml-diagrams', 'ghi', HEIGHT),
    '```'
  ].join('\n');
  const result = restoreWidgets(text, 'plantuml-diagrams', {abc: 'A -> B', def: 'X', ghi: 'Y'});
  assert.deepEqual(result.keys, ['abc']);
  const expected = ['Intro', '```plantuml', 'A -> B', '```'];
  assert.equal(result.text.split('\n').slice(0, expected.length).join('\n'), expected.join('\n'));
  assert.ok(result.text.includes('other-app') && result.text.includes('stays') && result.text.includes(':ghi)'));
});

test('a block survives convert and restore unchanged', () => {
  const converted = replaceBlocks(TEXT, (_, index) => embedLine('plantuml-diagrams', `k${index}`, HEIGHT));
  assert.equal(restoreWidgets(converted, 'plantuml-diagrams', {k0: findBlocks(TEXT)[0]}).text,
    TEXT.replace('привет   ', 'привет'));
});
