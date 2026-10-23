/**
 * Item in the options menu of an issue or article: converts ```plantuml code blocks to PlantUML
 * widgets and back. The item changes the text only when the user selects an action in it. It is
 * visible only to users who can edit, and only in projects the app is attached to.
 *
 * ponytail: uses REST fields that the public API does not document (`markdownEmbeddings`,
 * `admin/widgets/general`). They are what the editor uses to insert a widget. If an update
 * changes them, conversion stops with an error in this panel; inserted diagrams keep working.
 */

import React, {useCallback, useEffect, useState} from 'react';
import type {FC} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import {DIAGRAM_WIDGET, embedLine, findBlocks, replaceBlocks, restoreWidgets} from '../plantuml-app/blocks';
import {renderBoth} from '../plantuml-app/plantuml';
import type {Settings} from '../plantuml-app/plantuml';

type Embedding = {id: string; key: string; $type: string; settings?: string; widget?: {id: string}};
type Widget = {id: string; key: string; appId: string; appName: string};
type View =
  | {kind: 'busy'; text: string}
  | {kind: 'ready'; blocks: number; diagrams: number; done?: string}
  | {kind: 'failed'; message: string};

// Height of the block when the diagram cannot be rendered: room for the error message.
const ERROR_HEIGHT = 120;
// Space above and below the diagram inside the block.
const VERTICAL_PADDING = 16;
const KEY_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const KEY_LENGTH = 3;

const host = await YTApp.register();
const isArticle = YTApp.entity?.type === 'article';
const resource = `${isArticle ? 'articles' : 'issues'}/${YTApp.entity?.id}`;
const field = isArticle ? 'content' : 'description';
const embeddingType = isArticle ? 'ArticleWidgetEmbedding' : 'IssueWidgetEmbedding';

async function readEntity(): Promise<{text: string; embeddings: Embedding[]}> {
  const fields = `${field},markdownEmbeddings(id,key,$type,settings,widget(id))`;
  const entity = await host.fetchYouTrack(`${resource}?fields=${fields}`, {}) as
    Record<string, string> & {markdownEmbeddings?: Embedding[]};
  return {text: entity[field] ?? '', embeddings: entity.markdownEmbeddings ?? []};
}

/** Saves the text and the full embedding list: the list replaces the old one. */
function writeEntity(text: string, embeddings: object[]) {
  return host.fetchYouTrack(`${resource}?fields=id`, {method: 'POST', body: {[field]: text, markdownEmbeddings: embeddings}});
}

const keep = (embeddings: Embedding[]) => embeddings.map(({id, $type}) => ({id, $type}));

let widgetPromise: Promise<Widget> | null = null;
function diagramWidget(): Promise<Widget> {
  widgetPromise ??= (host.fetchYouTrack('admin/widgets/general?fields=id,key,appId,appName&$top=-1', {}) as Promise<Widget[]>).
    then(widgets => {
      const widget = widgets.find(it => it.appId === YTApp.widget?.appId && it.key === DIAGRAM_WIDGET);
      if (!widget) {
        throw new Error('The PlantUML diagram widget is not available.');
      }
      return widget;
    });
  return widgetPromise;
}

function newKey(used: Set<string>): string {
  let key;
  do {
    key = Array.from({length: KEY_LENGTH}, () => KEY_LETTERS[Math.floor(Math.random() * KEY_LETTERS.length)]).join('');
  } while (used.has(key));
  used.add(key);
  return key;
}

type Block = {height: number; settings: Settings};

/**
 * Renders one block in both themes. The widget shows the stored SVG, so readers do not load the
 * engine. The height is the block height that shows the whole diagram.
 */
async function prepareBlock(source: string): Promise<Block> {
  try {
    const rendered = await renderBoth(source);
    const height = Number(/height="(\d+(?:\.\d+)?)"/.exec(rendered.svg)?.[1] ?? ERROR_HEIGHT);
    return {height: Math.ceil(height) + VERTICAL_PADDING, settings: {source, ...rendered}};
  } catch {
    // Without stored SVG the widget renders the source when it is shown and displays the error.
    return {height: ERROR_HEIGHT, settings: {source}};
  }
}

/** Replaces the code blocks with diagram widgets in one update. Returns the result for the user. */
async function convert(): Promise<string> {
  const {text} = await readEntity();
  const sources = findBlocks(text);
  if (sources.length === 0) {
    return 'No PlantUML code blocks to convert';
  }
  const widget = await diagramWidget();
  // The engine runs renders one at a time on its own.
  const blocks = await Promise.all(sources.map(prepareBlock));
  // Somebody may have saved while the diagrams were rendering: do not overwrite that change.
  const current = await readEntity();
  if (current.text !== text) {
    throw new Error('The text changed during the conversion. Try again.');
  }
  const used = new Set(current.embeddings.map(embedding => embedding.key));
  const added = blocks.map(block => ({
    $type: embeddingType,
    key: newKey(used),
    widget: {id: widget.id},
    settings: JSON.stringify(block.settings)
  }));
  const newText = replaceBlocks(text, (_, index) => embedLine(widget.appName, added[index].key, blocks[index].height));
  await writeEntity(newText, [...keep(current.embeddings), ...added]);
  return `Converted ${plural(blocks.length, 'code block')}`;
}

/** Replaces the diagram widgets with code blocks of their source. Returns the result for the user. */
async function revert(): Promise<string> {
  const widget = await diagramWidget();
  const {text, embeddings} = await readEntity();
  const sources: Record<string, string> = {};
  for (const embedding of embeddings) {
    if (embedding.widget?.id === widget.id) {
      sources[embedding.key] = (JSON.parse(embedding.settings || '{}') as {source?: string}).source ?? '';
    }
  }
  const result = restoreWidgets(text, widget.appName, sources);
  if (result.keys.length === 0) {
    return 'No PlantUML diagrams to revert';
  }
  await writeEntity(result.text, keep(embeddings.filter(embedding => !result.keys.includes(embedding.key))));
  return `Reverted ${plural(result.keys.length, 'diagram')} to code`;
}

async function load(done?: string): Promise<View> {
  const [{text, embeddings}, widget] = await Promise.all([readEntity(), diagramWidget()]);
  return {
    kind: 'ready',
    done,
    blocks: findBlocks(text).length,
    diagrams: embeddings.filter(embedding => embedding.widget?.id === widget.id).length
  };
}

function plural(count: number, word: string): string {
  return `${count} PlantUML ${word}${count === 1 ? '' : 's'}`;
}

const failed = (e: Error): View => ({kind: 'failed', message: e?.message ?? String(e)});

type Run = (text: string, action: () => Promise<string>) => void;

const Ready: FC<{view: Extract<View, {kind: 'ready'}>; run: Run}> = ({view, run}) => {
  const found = [
    view.blocks > 0 && plural(view.blocks, 'code block'),
    view.diagrams > 0 && plural(view.diagrams, 'diagram')
  ].filter(Boolean).join(', ');
  return (
    <div className="menu">
      {view.done && <span className="text">{view.done}</span>}
      <span className="text">{found || 'No PlantUML code blocks or diagrams in the text'}</span>
      {view.blocks > 0 && (
        <Button primary onClick={() => run('Converting PlantUML code blocks…', convert)}>{'Convert to diagrams'}</Button>
      )}
      {view.diagrams > 0 && (
        <Button onClick={() => run('Restoring PlantUML code blocks…', revert)}>{'Revert to code'}</Button>
      )}
    </div>
  );
};

export const App: FC = () => {
  const [view, setView] = useState<View>({kind: 'busy', text: ''});

  const run = useCallback<Run>((text, action) => {
    setView({kind: 'busy', text});
    action().then(load).then(setView, e => setView(failed(e)));
  }, []);

  useEffect(() => {
    load().then(setView, e => setView(failed(e)));
  }, []);

  if (view.kind === 'busy') {
    return <div className="menu"><span className="text">{view.text}</span></div>;
  }
  if (view.kind === 'failed') {
    return <div className="menu"><span className="text error">{`PlantUML: ${view.message}`}</span></div>;
  }
  return <Ready view={view} run={run}/>;
};
