import type { KeyboardEvent } from 'react';

// Makes a clickable non-button element (e.g. a card) work like a button for
// keyboard and screen reader users: focusable, announced as a button, and
// activated with Enter or Space. Keys pressed on nested controls are ignored.
export const buttonRole = (onActivate: () => void) => ({
  role: 'button',
  tabIndex: 0,
  onClick: onActivate,
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  },
});
