import { useEffect, useState, type RefObject } from "react";

export function useCinemaControls(root: RefObject<HTMLDivElement | null>, enabled: boolean, blocked: boolean) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = root.current;
    setVisible(true);
    if (!enabled || !element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const engaged = () => {
      const active = document.activeElement;
      return blocked || Boolean(element.querySelector('details[open], [role="menu"], [role="dialog"]'))
        || Boolean(document.querySelector('[aria-modal="true"], dialog[open]'))
        || Boolean(active && element.contains(active) && active.matches('button, select, input, textarea, summary, [role="separator"]'));
    };
    const reveal = () => {
      if (disposed) return;
      clearTimeout(timer);
      setVisible(true);
      if (!engaged()) timer = setTimeout(() => { if (!engaged()) setVisible(false); }, 3000);
    };
    const events = ["pointermove", "pointerdown", "keydown", "focusin", "focusout", "toggle"];
    events.forEach(event => element.addEventListener(event, reveal, true));
    // Focusout precedes the next activeElement; schedule after focus has settled.
    const onFocusOut = () => { queueMicrotask(reveal); };
    element.addEventListener("focusout", onFocusOut);
    // Screen-share/settings dialogs are portals outside the call root.
    const portals = new MutationObserver(reveal);
    portals.observe(document.body, { childList: true });
    reveal();
    return () => {
      disposed = true;
      clearTimeout(timer);
      events.forEach(event => element.removeEventListener(event, reveal, true));
      element.removeEventListener("focusout", onFocusOut);
      portals.disconnect();
    };
  }, [root, enabled, blocked]);
  return visible;
}
