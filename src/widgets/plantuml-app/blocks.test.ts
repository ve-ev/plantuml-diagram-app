import assert from 'node:assert/strict';
import {test} from 'node:test';
import {findBlocks, replaceBlocks} from './blocks.ts';

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
