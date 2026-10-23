import {useEffect, useState} from 'react';

// The host sets this class on the widget body when its theme is dark, also after the page loads.
const DARK_CLASS = 'ring-ui-theme-dark';

export function useDark(): boolean {
  const [dark, setDark] = useState(() => document.body.classList.contains(DARK_CLASS));
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.body.classList.contains(DARK_CLASS)));
    observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
    return () => observer.disconnect();
  }, []);
  return dark;
}
