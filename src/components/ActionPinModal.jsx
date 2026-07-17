import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, X, Eye, EyeOff } from 'lucide-react';
import styles from './ActionPinModal.module.css';

const ActionPinModal = ({ isOpen, onClose, onSuccess, requiredPin, actionName = "this action" }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === requiredPin) {
      setPin('');
      setError('');
      onSuccess();
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={`${styles.modal} glass-panel animate-fade-in`}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '0.5rem', borderRadius: '50%', color: '#eab308' }}>
              <Shield size={20} />
            </div>
            <h3 className="heading-3" style={{ marginBottom: 0 }}>Security Verification</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Please enter your PIN to {actionName}.
          </p>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPin ? "text" : "password"}
                  className="input-field" 
                  placeholder="Enter PIN" 
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError('');
                  }}
                  autoFocus
                  style={{ textAlign: 'center', letterSpacing: '0.25rem', fontSize: '1.25rem', paddingRight: '2.5rem' }}
                />
                <button 
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>{error}</p>}
            </div>
            
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Verify & Continue
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ActionPinModal;
