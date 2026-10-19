/**
 * Client of the app's render endpoint (render.js). The widget never loads the engine.
 */

import type {CustomWidgetAPILayer} from '../../../@types/globals';

export type Rendered = {svg: string; svgDark: string};

export async function renderSvg(host: CustomWidgetAPILayer, source: string, dark: boolean): Promise<string> {
  const result = await host.fetchApp('render/svg', {method: 'POST', body: {source, dark}}) as
    {svg?: string; error?: string};
  if (result.error || !result.svg) {
    throw new Error(result.error ?? 'PlantUML render failed');
  }
  return result.svg;
}

/** Both themes, rendered in parallel. `known` is a theme that is already rendered. */
export async function renderBoth(
  host: CustomWidgetAPILayer,
  source: string,
  known: Partial<Rendered> = {}
): Promise<Rendered> {
  const [svg, svgDark] = await Promise.all([
    known.svg ?? renderSvg(host, source, false),
    known.svgDark ?? renderSvg(host, source, true)
  ]);
  return {svg, svgDark};
}
