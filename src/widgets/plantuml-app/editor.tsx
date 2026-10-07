import React, {memo, useEffect, useState} from 'react';
import type {FC} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import ButtonSet from '@jetbrains/ring-ui-built/components/button-set/button-set';
import Input, {Size} from '@jetbrains/ring-ui-built/components/input/input';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import {Diagram} from './diagram';

const PREVIEW_DELAY_MS = 400;

type Props = {
  initialSource: string;
  canCancel: boolean;
  host: {enterConfigMode: () => void; exitConfigMode: () => void};
  onSave: (source: string) => Promise<void>;
  onCancel: () => void;
};

/**
 * Mounting the editor switches the host into config mode: YouTrack shows the widget in a dialog.
 */
const EditorComponent: FC<Props> = ({initialSource, canCancel, host, onSave, onCancel}) => {
  const [source, setSource] = useState(initialSource);
  const [preview, setPreview] = useState(initialSource);
  const [height, setHeight] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    host.enterConfigMode();
    return () => host.exitConfigMode();
  }, [host]);

  useEffect(() => {
    const timer = setTimeout(() => setPreview(source), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [source]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(source);
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
        {preview.trim() && <Diagram source={preview} onSize={size => setHeight(size.height)}/>}
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

export const Editor = memo(EditorComponent);
