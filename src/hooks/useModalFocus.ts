import { useEffect, useLayoutEffect, useRef } from 'react';

const layers: HTMLElement[] = [];
const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

/** Only the top dialog handles keys; nested dialogs restore their own trigger. */
export function useModalFocus<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void, closeOnEscape = true) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => { close.current = onClose; });
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    layers.push(element);
    const controls = () => Array.from(element.querySelectorAll<HTMLElement>(focusable))
      .filter(node => node.getClientRects().length > 0 && !node.closest('[hidden]'));
    const focusFirst = () => (controls()[0] ?? element).focus();
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (layers.at(-1) !== element) return;
      if (event.key === 'Escape' && closeOnEscape) {
        if (event.target instanceof HTMLElement && event.target.dataset.hotkeyCapturing === 'true') return;
        event.preventDefault(); event.stopImmediatePropagation(); close.current();
      } else if (event.key === 'Tab') {
        const nodes = controls();
        const index = nodes.indexOf(document.activeElement as HTMLElement);
        if (!nodes.length || (event.shiftKey ? index <= 0 : index < 0 || index === nodes.length - 1)) {
          event.preventDefault();
          (event.shiftKey ? nodes.at(-1) ?? element : nodes[0] ?? element).focus();
        }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (layers.at(-1) === element && !element.contains(event.target as Node)) focusFirst();
    };
    window.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin);
    return () => {
      layers.splice(layers.indexOf(element), 1);
      window.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', focusin);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open, closeOnEscape]);
  return ref;
}
