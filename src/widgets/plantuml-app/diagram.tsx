import React, {memo, useEffect, useState} from 'react';
import type {FC} from 'react';
import {renderSvg} from './plantuml';

// The host sets this class on the widget body when its theme is dark, also after the page loads.
const DARK_CLASS = 'ring-ui-theme-dark';

function useDark(): boolean {
  const [dark, setDark] = useState(() => document.body.classList.contains(DARK_CLASS));
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.body.classList.contains(DARK_CLASS)));
    observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
    return () => observer.disconnect();
  }, []);
  return dark;
}

type Props = {
  source: string;
  onSize?: (size: {width: number; height: number}) => void;
};

/**
 * Shows one diagram as an <img>, so scripts and links inside the SVG never run.
 */
const DiagramComponent: FC<Props> = ({source, onSize}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dark = useDark();

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    renderSvg(source, dark).then(svg => {
      if (cancelled) {
        return;
      }
      objectUrl = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
      setUrl(objectUrl);
      setError(null);
    }, (e: Error) => {
      if (!cancelled) {
        setError(e.message);
      }
    });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [source, dark]);

  if (error) {
    return <pre className="diagram-error">{error}</pre>;
  }
  if (!url) {
    return null;
  }
  return (
    <img
      className="diagram"
      src={url}
      alt="PlantUML diagram"
      onLoad={e => onSize?.({width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight})}
    />
  );
};

export const Diagram = memo(DiagramComponent);
