import React, {memo, useCallback, useEffect, useState} from 'react';
import type {FC} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import type {CustomWidgetAPILayer} from '../../../@types/globals';
import {Diagram} from './diagram';
import {Editor} from './editor';

type Config = {source?: string};

let requestEdit: (() => void) | null = null;

const host = await YTApp.register({onConfigure: () => requestEdit?.()}) as CustomWidgetAPILayer;
// The host passes `editable=true` in the page hash when the current user can edit the text.
const editable = new URLSearchParams(location.hash.slice(1)).get('editable') === 'true';

const AppComponent: FC = () => {
  const [source, setSource] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);

  requestEdit = useCallback(() => setEditing(true), []);

  useEffect(() => {
    host.readConfig().then(config => {
      const stored = (config as Config | null)?.source;
      setSource(stored || null);
      // `onConfigure` is not called on insertion, so a new instance opens the editor itself.
      setEditing(!stored && editable);
    }).catch(() => setEditing(editable)).finally(() => setReady(true));
  }, []);

  const save = useCallback(async (next: string) => {
    await host.storeConfig({source: next});
    setSource(next);
    setEditing(false);
  }, []);

  if (!ready) {
    return null;
  }
  if (editing) {
    return (
      <Editor
        initialSource={source ?? ''}
        canCancel={source !== null}
        host={host}
        onSave={save}
        onCancel={() => setEditing(false)}
      />
    );
  }
  if (!source) {
    return editable
      ? <Button className="placeholder" onClick={() => setEditing(true)}>{'PlantUML diagram — click to edit'}</Button>
      : null;
  }
  return (
    <div className="view">
      <Diagram source={source}/>
      {editable && <Button className="edit" onClick={() => setEditing(true)}>{'Edit'}</Button>}
    </div>
  );
};

export const App = memo(AppComponent);
