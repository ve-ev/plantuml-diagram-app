import React, {lazy, memo, Suspense, useCallback, useEffect, useState} from 'react';
import type {FC} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import type {CustomWidgetAPILayer} from '../../../@types/globals';
import {Diagram} from './diagram';
import {useDark} from './use-dark';
import {renderBoth} from './plantuml';
import type {Rendered} from './plantuml';

// Readers never load the editor.
const Editor = lazy(() => import('./editor'));

type Config = {source?: string; svg?: string; svgDark?: string};

let requestEdit: (() => void) | null = null;

const host = await YTApp.register({onConfigure: () => requestEdit?.()}) as CustomWidgetAPILayer;
// The host passes `editable=true` in the page hash when the current user can edit the text.
const editable = new URLSearchParams(location.hash.slice(1)).get('editable') === 'true';

/**
 * The configuration holds the source and the SVG rendered when it was saved. Diagrams saved by an
 * older version have no SVG: they are rendered on the server for each view until the next edit.
 */
async function readDiagram(): Promise<{source: string; rendered: Rendered} | null> {
  const config = await host.readConfig() as Config | null;
  if (!config?.source) {
    return null;
  }
  const rendered = config.svg && config.svgDark
    ? {svg: config.svg, svgDark: config.svgDark}
    : await renderBoth(host, config.source);
  return {source: config.source, rendered};
}

const View: FC<{diagram: {rendered: Rendered} | null; onEdit: () => void}> = ({diagram, onEdit}) => {
  const dark = useDark();
  if (!diagram) {
    return editable
      ? <Button className="placeholder" onClick={onEdit}>{'PlantUML diagram — click to edit'}</Button>
      : null;
  }
  return (
    <div className="view">
      <Diagram svg={dark ? diagram.rendered.svgDark : diagram.rendered.svg}/>
      {editable && <Button className="edit" onClick={onEdit}>{'Edit'}</Button>}
    </div>
  );
};

const AppComponent: FC = () => {
  const [diagram, setDiagram] = useState<{source: string; rendered: Rendered} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);

  requestEdit = useCallback(() => setEditing(true), []);

  useEffect(() => {
    readDiagram().then(stored => {
      setDiagram(stored);
      // `onConfigure` is not called on insertion, so a new instance opens the editor itself.
      setEditing(!stored && editable);
    }, (e: Error) => setError(e.message)).finally(() => setReady(true));
  }, []);

  const save = useCallback(async (source: string, rendered: Rendered) => {
    await host.storeConfig({source, ...rendered});
    setDiagram({source, rendered});
    setError(null);
    setEditing(false);
  }, []);

  if (!ready) {
    return null;
  }
  if (editing) {
    return (
      <Suspense fallback={null}>
        <Editor
          initialSource={diagram?.source ?? ''}
          canCancel={diagram !== null}
          host={host}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      </Suspense>
    );
  }
  if (error) {
    return <pre className="diagram-error">{error}</pre>;
  }
  return <View diagram={diagram} onEdit={() => setEditing(true)}/>;
};

export const App = memo(AppComponent);
