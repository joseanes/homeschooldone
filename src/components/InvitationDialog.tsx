import React, { useState } from 'react';
import Modal from './Modal';

interface InvitationDialogProps {
  email: string;
  subject: string;
  body: string;
  onClose: () => void;
}

const InvitationDialog: React.FC<InvitationDialogProps> = ({ email, subject, body, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAll = () => {
    const fullText = `To: ${email}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    alert('Invitation text copied to clipboard!');
  };

  const handleOpenEmail = () => {
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  return (
    <Modal maxWidth="600px">
      <h2 style={{ marginBottom: '20px' }}>Send Invitation</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          marginBottom: '10px'
        }}>
          <strong>To:</strong>
          <span style={{ 
            backgroundColor: 'var(--hs-bg-surface)', 
            padding: '4px 8px', 
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>
            {email}
          </span>
          <button
            onClick={handleCopyEmail}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: copied ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {copied ? '✓ Copied' : 'Copy Email'}
          </button>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <strong>Subject:</strong> {subject}
        </div>
      </div>
      
      <div style={{
        backgroundColor: 'var(--hs-bg-surface)',
        padding: '15px',
        borderRadius: '4px',
        marginBottom: '20px',
        whiteSpace: 'pre-wrap',
        fontSize: '14px',
        maxHeight: '300px',
        overflow: 'auto',
        border: '1px solid var(--hs-border-light)'
      }}>
        {body}
      </div>
      
      <div style={{ fontSize: '14px', color: 'var(--hs-text-secondary)', marginBottom: '20px' }}>
        <strong>Choose how to send:</strong>
        <ol style={{ marginTop: '10px', marginBottom: 0 }}>
          <li>Click "Open Email Client" to use your default email app</li>
          <li>Or copy the text and send it manually from any email service</li>
        </ol>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={handleOpenEmail}
          className="hs-btn hs-btn--primary"
        >
          📧 Open Email Client
        </button>
        <button
          onClick={handleCopyAll}
          className="hs-btn hs-btn--success"
        >
          📋 Copy All Text
        </button>
        <button
          onClick={onClose}
          className="hs-btn hs-btn--secondary"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default InvitationDialog;