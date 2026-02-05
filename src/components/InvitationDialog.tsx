import React, { useState } from 'react';

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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
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
              backgroundColor: '#f0f0f0', 
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
          backgroundColor: '#f8f9fa',
          padding: '15px',
          borderRadius: '4px',
          marginBottom: '20px',
          whiteSpace: 'pre-wrap',
          fontSize: '14px',
          maxHeight: '300px',
          overflow: 'auto',
          border: '1px solid #dee2e6'
        }}>
          {body}
        </div>
        
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
          <strong>Choose how to send:</strong>
          <ol style={{ marginTop: '10px', marginBottom: 0 }}>
            <li>Click "Open Email Client" to use your default email app</li>
            <li>Or copy the text and send it manually from any email service</li>
          </ol>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleOpenEmail}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📧 Open Email Client
          </button>
          <button
            onClick={handleCopyAll}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📋 Copy All Text
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvitationDialog;