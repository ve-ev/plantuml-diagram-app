import React from 'react';
import type {FC} from 'react';

type Props = {
  svg: string;
  onSize?: (size: {width: number; height: number}) => void;
};

/**
 * Shows one rendered diagram as an <img>, so scripts and links inside the SVG never run. The image
 * is a data: URL: it has an opaque origin also when a user opens it in a new tab.
 */
export const Diagram: FC<Props> = ({svg, onSize}) => (
  <img
    className="diagram"
    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
    alt="PlantUML diagram"
    onLoad={e => onSize?.({width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight})}
  />
);
