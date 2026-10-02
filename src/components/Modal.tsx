import React from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  children: React.ReactNode;
  maxWidth?: string;
  style?: React.CSSProperties;
}

// Rendered into document.body, so every dialog shares one z-index and the
// most recently opened one stacks on top (no per-dialog zIndex values).
const Modal: React.FC<ModalProps> = ({ children, maxWidth = '500px', style }) =>
  createPortal(
    <div className="hs-modal-overlay">
      <div className="hs-modal-panel" role="dialog" aria-modal="true" style={{ maxWidth, ...style }}>
        {children}
      </div>
    </div>,
    document.body
  );

export default Modal;
