/**
 * Replaces ```plantuml code blocks with PlantUML widgets after each save. The host loads this
 * widget again when the issue or article changes, so a load is the signal to look at the text.
 * The widget is visible only to users who can edit, and only in projects the app is attached to.
 *
 * ponytail: uses REST fields that the public API does not document (`markdownEmbeddings`,
 * `admin/widgets/general`). They are what the editor uses to insert a widget. If an update
 * changes them, conversion stops with an error in this panel; inserted diagrams keep working.
 */

import React, {memo, useEffect, useState} from 'react';
import type {FC} from 'react';
import type {CustomWidgetAPILayer} from '../../../@types/globals';
import {findBlocks, replaceBlocks} from '../plantuml-app/blocks';
import {renderSvg} from '../plantuml-app/plantuml';

type Embedding = {id: string; key: string; $type: string};
type Widget = {id: string; key: string; appId: string; appName: string};
type Status = {kind: 'idle'} | {kind: 'done'; count: number} | {kind: 'failed'; message: string};

const DIAGRAM_WIDGET = 'plantuml-app';
// Height of the block when the diagram cannot be rendered: room for the error message.
const ERROR_HEIGHT = 120;
// Space above and below the diagram inside the block.
const VERTICAL_PADDING = 16;
const KEY_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const KEY_LENGTH = 3;

const host = await YTApp.register() as CustomWidgetAPILayer;
const isArticle = YTApp.entity?.type === 'article';
const resource = `${isArticle ? 'articles' : 'issues'}/${YTApp.entity?.id}`;
const field = isArticle ? 'content' : 'description';
const embeddingType = isArticle ? 'ArticleWidgetEmbedding' : 'IssueWidgetEmbedding';

async function readEntity(): Promise<{text: string; embeddings: Embedding[]}> {
  const entity = await host.fetchYouTrack(`${resource}?fields=${field},markdownEmbeddings(id,key,$type)`, {}) as
    Record<string, string> & {markdownEmbeddings?: Embedding[]};
  return {text: entity[field] ?? '', embeddings: entity.markdownEmbeddings ?? []};
}

async function diagramWidget(): Promise<Widget> {
  const widgets = await host.fetchYouTrack('admin/widgets/general?fields=id,key,appId,appName&$top=-1', {}) as Widget[];
  const widget = widgets.find(it => it.appId === YTApp.widget?.appId && it.key === DIAGRAM_WIDGET);
  if (!widget) {
    throw new Error('The PlantUML diagram widget is not available.');
  }
  return widget;
}

function newKey(used: Set<string>): string {
  let key;
  do {
    key = Array.from({length: KEY_LENGTH}, () => KEY_LETTERS[Math.floor(Math.random() * KEY_LETTERS.length)]).join('');
  } while (used.has(key));
  used.add(key);
  return key;
}

/** The block height that shows the whole diagram. */
async function blockHeight(source: string): Promise<number> {
  try {
    const svg = await renderSvg(source, false);
    return Math.ceil(Number(/height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? ERROR_HEIGHT)) + VERTICAL_PADDING;
  } catch {
    return ERROR_HEIGHT;
  }
}

/** Replaces the blocks with widgets in one update. Returns the number of replaced blocks. */
async function convert(): Promise<number> {
  const {text} = await readEntity();
  const sources = findBlocks(text);
  if (sources.length === 0 || YTApp.entity?.isEditing) {
    return 0;
  }
  const widget = await diagramWidget();
  const heights = [];
  for (const source of sources) {
    heights.push(await blockHeight(source));
  }
  // Somebody may have saved while the diagrams were rendering. The next load tries again.
  const current = await readEntity();
  if (current.text !== text) {
    return 0;
  }
  const used = new Set(current.embeddings.map(embedding => embedding.key));
  const added = sources.map(source => ({
    $type: embeddingType,
    key: newKey(used),
    widget: {id: widget.id},
    settings: JSON.stringify({source})
  }));
  const newText = replaceBlocks(text, (source, index) =>
    `![](widget:${widget.appName}:${DIAGRAM_WIDGET}:${added[index].key}){width=100% height=${heights[index]}px}`);
  const kept = current.embeddings.map(({id, $type}) => ({id, $type}));
  // The list replaces the old one, so the existing widgets are sent too.
  await host.fetchYouTrack(`${resource}?fields=id`, {
    method: 'POST',
    body: {[field]: newText, markdownEmbeddings: [...kept, ...added]}
  });
  return sources.length;
}

const AppComponent: FC = () => {
  const [status, setStatus] = useState<Status>({kind: 'idle'});

  useEffect(() => {
    convert().then(
      count => setStatus(count > 0 ? {kind: 'done', count} : {kind: 'idle'}),
      (e: Error) => setStatus({kind: 'failed', message: e?.message ?? String(e)})
    );
  }, []);

  if (status.kind === 'failed') {
    return <pre className="panel-errors">{`PlantUML code blocks were not converted: ${status.message}`}</pre>;
  }
  return (
    <div className="panel-text">
      {status.kind === 'done'
        ? `${status.count} PlantUML code block(s) converted to diagrams.`
        : 'Write PlantUML in a ```plantuml code block. It becomes a diagram when you save.'}
    </div>
  );
};

export const App = memo(AppComponent);
