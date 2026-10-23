import React, {memo, useEffect, useState} from 'react';
import type {FC} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import ButtonSet from '@jetbrains/ring-ui-built/components/button-set/button-set';
import Input, {Size} from '@jetbrains/ring-ui-built/components/input/input';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import {Diagram} from './diagram';
import {useDark} from './use-dark';
import {renderBoth, renderSvg} from './plantuml';
import type {Rendered} from './plantuml';

const PREVIEW_DELAY_MS = 400;

type Props = {
  initialSource: string;
  canCancel: boolean;
  host: {enterConfigMode: () => void; exitConfigMode: () => void};
  onSave: (source: string, rendered: Rendered) => Promise<void>;
  onCancel: () => void;
};

/**
 * Mounting the editor switches the host into config mode, which shows the widget in a dialog.
 */
const EditorComponent: FC<Props> = ({initialSource, canCancel, host, onSave, onCancel}) => {
  const [source, setSource] = useState(initialSource);
  // The preview renders the current theme only; saving renders the other one if it is not cached.
  const [preview, setPreview] = useState<{source: string; svg?: string; error?: string} | null>(null);
  const dark = useDark();
  const [height, setHeight] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    host.enterConfigMode();
    return () => host.exitConfigMode();
  }, [host]);

  useEffect(() => {
    if (!source.trim()) {
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => renderSvg(source, dark).then(
      svg => !cancelled && setPreview({source, svg}),
      (e: Error) => !cancelled && setPreview({source, error: e.message})
    ), PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, dark]);

  const save = async () => {
    setSaving(true);
    try {
      // Renders only what the preview and the stored diagram do not have yet.
      await onSave(source, await renderBoth(source));
    } catch (e) {
      setPreview({source, error: (e as Error).message});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor">
      <Input
        multiline
        size={Size.FULL}
        rows={12}
        label="PlantUML source"
        value={source}
        placeholder={'Alice -> Bob : hello'}
        className="editor-source"
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSource(e.target.value)}
      />
      <div className="editor-preview">
        {preview?.svg && <Diagram svg={preview.svg} onSize={size => setHeight(size.height)}/>}
        {preview?.error && <pre className="diagram-error">{preview.error}</pre>}
      </div>
      {height !== null && (
        <Text info size="s">
          {`The diagram is ${height}px high. A widget cannot resize itself: drag the bottom edge of the block to show it at full size.`}
        </Text>
      )}
      <ButtonSet>
        <Button primary loader={saving} disabled={!source.trim()} onClick={save}>{'Save'}</Button>
        {canCancel && <Button onClick={onCancel}>{'Cancel'}</Button>}
      </ButtonSet>
    </div>
  );
};

export default memo(EditorComponent);
