/**
 * One-line panel that converts ```plantuml code blocks to PlantUML widgets and back. Nothing
 * changes until a user selects "Convert to diagrams" for this issue or article. After that, the
 * blocks are converted after each save: the host loads this widget again when the item changes.
 * The widget is visible only to users who can edit, and only in projects the app is attached to.
 *
 * ponytail: uses REST fields that the public API does not document (`markdownEmbeddings`,
 * `admin/widgets/general`). They are what the editor uses to insert a widget. If an update
 * changes them, conversion stops with an error in this panel; inserted diagrams keep working.
 */

import React, {memo, useCallback, useEffect, useState} from 'react';
import type {FC} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import type {CustomWidgetAPILayer} from '../../../@types/globals';
import {DIAGRAM_WIDGET, embedLine, findBlocks, replaceBlocks, restoreWidgets} from '../plantuml-app/blocks';
import {renderSvg} from '../plantuml-app/plantuml';

type Embedding = {id: string; key: string; $type: string; settings?: string; widget?: {id: string}};
type Widget = {id: string; key: string; appId: string; appName: string};
type View =
  | {kind: 'busy'; text: string}
  | {kind: 'ready'; blocks: number; diagrams: number; enabled: boolean}
  | {kind: 'failed'; message: string};

// Height of the block when the diagram cannot be rendered: room for the error message.
const ERROR_HEIGHT = 120;
// Space above and below the diagram inside the block.
const VERTICAL_PADDING = 16;
const KEY_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const KEY_LENGTH = 3;

const host = await YTApp.register() as CustomWidgetAPILayer;
const isArticle = YTApp.entity?.type === 'article';
const scope = isArticle ? 'article' : 'issue';
const resource = `${isArticle ? 'articles' : 'issues'}/${YTApp.entity?.id}`;
const field = isArticle ? 'content' : 'description';
const embeddingType = isArticle ? 'ArticleWidgetEmbedding' : 'IssueWidgetEmbedding';

const readEnabled = async () => ((await host.fetchApp(`blocks/${scope}/state`, {scope: true})) as {enabled: boolean}).enabled;
const writeEnabled = (enabled: boolean) => host.fetchApp(`blocks/${scope}/state`, {scope: true, method: 'POST', body: {enabled}});

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

/** The block height that shows the whole diagram. */
async function blockHeight(source: string): Promise<number> {
  try {
    const svg = await renderSvg(source, false);
    return Math.ceil(Number(/height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? ERROR_HEIGHT)) + VERTICAL_PADDING;
  } catch {
    return ERROR_HEIGHT;
  }
}

/** Replaces the code blocks with diagram widgets in one update. */
async function convert(): Promise<void> {
  const {text} = await readEntity();
  const sources = findBlocks(text);
  if (sources.length === 0) {
    return;
  }
  const widget = await diagramWidget();
  const heights = [];
  for (const source of sources) {
    heights.push(await blockHeight(source));
  }
  // Somebody may have saved while the diagrams were rendering. The next load tries again.
  const current = await readEntity();
  if (current.text !== text) {
    return;
  }
  const used = new Set(current.embeddings.map(embedding => embedding.key));
  const added = sources.map(source => ({
    $type: embeddingType,
    key: newKey(used),
    widget: {id: widget.id},
    settings: JSON.stringify({source})
  }));
  const newText = replaceBlocks(text, (_, index) => embedLine(widget.appName, added[index].key, heights[index]));
  await writeEntity(newText, [...keep(current.embeddings), ...added]);
}

/** Replaces the diagram widgets with code blocks of their source. */
async function revert(): Promise<void> {
  const widget = await diagramWidget();
  const {text, embeddings} = await readEntity();
  const sources: Record<string, string> = {};
  for (const embedding of embeddings) {
    if (embedding.widget?.id === widget.id) {
      sources[embedding.key] = (JSON.parse(embedding.settings || '{}') as {source?: string}).source ?? '';
    }
  }
  const result = restoreWidgets(text, widget.appName, sources);
  if (result.keys.length > 0) {
    await writeEntity(result.text, keep(embeddings.filter(embedding => !result.keys.includes(embedding.key))));
  }
}

async function load(): Promise<View> {
  const [enabled, {text, embeddings}, widget] = await Promise.all([readEnabled(), readEntity(), diagramWidget()]);
  return {
    kind: 'ready',
    enabled,
    blocks: findBlocks(text).length,
    diagrams: embeddings.filter(embedding => embedding.widget?.id === widget.id).length
  };
}

const plural = (count: number, word: string) => `${count} PlantUML ${word}${count === 1 ? '' : 's'}`;

const AppComponent: FC = () => {
  const [view, setView] = useState<View>({kind: 'busy', text: ''});

  const run = useCallback((text: string, action: () => Promise<unknown>) => {
    setView({kind: 'busy', text});
    action().then(load).then(setView, (e: Error) => setView({kind: 'failed', message: e?.message ?? String(e)}));
  }, []);

  useEffect(() => {
    load().then(current => {
      const auto = current.kind === 'ready' && current.enabled && current.blocks > 0 && !YTApp.entity?.isEditing;
      return auto ? run('Converting PlantUML code blocks…', convert) : setView(current);
    }, (e: Error) => setView({kind: 'failed', message: e?.message ?? String(e)}));
  }, [run]);

  const enable = () => run('Converting PlantUML code blocks…', async () => {
    await writeEnabled(true);
    await convert();
  });
  // Turn conversion off first, so the next load does not convert the restored blocks again.
  const restore = () => run('Restoring PlantUML code blocks…', async () => {
    await writeEnabled(false);
    await revert();
  });

  if (view.kind === 'busy') {
    return <div className="line"><span className="text">{view.text}</span></div>;
  }
  if (view.kind === 'failed') {
    return <div className="line"><span className="text error" title={view.message}>{`PlantUML: ${view.message}`}</span></div>;
  }
  if (view.enabled) {
    return (
      <div className="line">
        <span className="text">{'PlantUML code blocks become diagrams on save'}</span>
        {view.diagrams > 0 && <Button text inline onClick={restore}>{'Revert to code'}</Button>}
      </div>
    );
  }
  if (view.blocks > 0) {
    return (
      <div className="line">
        <span className="text">{plural(view.blocks, 'code block')}</span>
        <Button text inline onClick={enable}>{'Convert to diagrams'}</Button>
      </div>
    );
  }
  if (view.diagrams > 0) {
    return (
      <div className="line">
        <span className="text">{plural(view.diagrams, 'diagram')}</span>
        <Button text inline onClick={restore}>{'Revert to code'}</Button>
      </div>
    );
  }
  return null;
};

export const App = memo(AppComponent);
