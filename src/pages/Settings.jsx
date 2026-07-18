import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { getSettings, updateSettings } from '../services/db';
import { generateExcelBackup } from '../services/backup';
import { Save, LogOut, Shield, Download, Lock, Calendar, Plus, Trash2, Edit2, Smartphone, CheckCircle, Eye, EyeOff, Key, Monitor, Clock, X, FolderOpen } from 'lucide-react';
import ActionPinModal from '../components/ActionPinModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { db } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { get, set } from 'idb-keyval';
import styles from './Settings.module.css';

const Settings = () => {
  const { user, profile, logout, sessionId, revokeSession, logoutAllOtherDevices } = useAuthStore();
  const { addToast } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const [formData, setFormData] = useState({
    billTitle: 'TAX INVOICE',
    businessName: '',
    businessAddress: '',
    businessContact: '',
    panVatNo: '',
    vatPercentage: 13,
    
    // Advanced settings
    actionPin: '',
    units: ['Pcs', 'Kg', 'Ltr', 'Mtr'],
    fiscalYearStartMonth: 'Shrawan',
    fiscalYearEndMonth: 'Ashadh',
    backupReminderFrequency: 'never',
    backupReminderTime: '17:00'
  });

  const [newUnit, setNewUnit] = useState('');
  const [backupFolder, setBackupFolder] = useState('');

  const [originalPin, setOriginalPin] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    // Load local backup folder name from IndexedDB
    get('backupDirectoryHandle').then(handle => {
      if (handle && handle.name) {
        setBackupFolder(handle.name);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsAppInstalled(true);
      return;
    }

    // Pick up the prompt if it already fired before this component mounted
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    // Listen for prompt becoming available after mount
    const onPromptReady = () => {
      setDeferredPrompt(window.__pwaInstallPrompt);
      setIsAppInstalled(false);
    };
    const onInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('pwaPromptReady', onPromptReady);
    window.addEventListener('pwaInstalled', onInstalled);

    return () => {
      window.removeEventListener('pwaPromptReady', onPromptReady);
      window.removeEventListener('pwaInstalled', onInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const prompt = deferredPrompt || window.__pwaInstallPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        window.__pwaInstallPrompt = null;
        setDeferredPrompt(null);
        setIsAppInstalled(true);
      }
    } else {
      addToast('Open your browser menu and choose "Add to Home Screen" or "Install App" to install.', 'info');
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'sessions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessData = [];
      snapshot.forEach(doc => sessData.push({ id: doc.id, ...doc.data() }));
      sessData.sort((a, b) => {
        if (a.id === sessionId) return -1;
        if (b.id === sessionId) return 1;
        return new Date(b.lastActive) - new Date(a.lastActive);
      });
      setSessions(sessData);
    });
    return () => unsubscribe();
  }, [user, sessionId]);



  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const data = await getSettings(user.uid);
      if (data) {
        setFormData(prev => ({ ...prev, ...data }));
        if (data.actionPin) setOriginalPin(data.actionPin);
      } else if (profile?.businessName) {
        setFormData(prev => ({ ...prev, businessName: profile.businessName }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'actionPin' && value.length > 4) return;
    if (name === 'businessContact' && (value.length > 10 || !/^\d*$/.test(value))) return;
    if (name === 'panVatNo' && (value.length > 9 || !/^\d*$/.test(value))) return;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUnit = () => {
    if (newUnit.trim() && !formData.units.includes(newUnit.trim())) {
      setFormData(prev => ({ ...prev, units: [...prev.units, newUnit.trim()] }));
      setNewUnit('');
    }
  };

  const handleRemoveUnit = (unitToRemove) => {
    setFormData(prev => ({
      ...prev,
      units: prev.units.filter(u => u !== unitToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        vatPercentage: Number(formData.vatPercentage) || 0
      };
      await updateSettings(user.uid, dataToSave);
      addToast('Settings updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to update settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await generateExcelBackup(user.uid);
      addToast('Data exported successfully!', 'success');
    } catch (error) {
      addToast('Failed to export data.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleLogoutAllOther = async () => {
    try {
      await logoutAllOtherDevices();
      addToast('All other devices have been signed out.', 'success');
    } catch (err) {
      addToast('Failed to sign out other devices.', 'error');
    }
  };

  const handleRevokeSession = async (sid) => {
    try {
      await revokeSession(sid);
      addToast('Device session revoked.', 'success');
    } catch (err) {
      addToast('Failed to revoke session.', 'error');
    }
  };

  const handleSelectFolder = async () => {
    if (!window.showDirectoryPicker) {
      addToast('Folder selection is not supported in this browser.', 'error');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await set('backupDirectoryHandle', handle);
      setBackupFolder(handle.name);
      addToast('Backup destination folder set successfully.', 'success');
    } catch (err) {
      if (err.name !== 'AbortError') {
        addToast('Failed to select folder.', 'error');
      }
    }
  };

  return (
    <div className={`animate-fade-in ${styles.container}`}>

      <form onSubmit={handleSubmit} className={styles.grid}>
        
        {/* LEFT COLUMN */}
        <div className={styles.columnLeft}>
          
          {/* Business Profile */}
          <div className={`${styles.card} glass-panel`}>
            <h2 className="heading-2">Business Profile</h2>
            <p className={styles.description}>Update your company details and invoice defaults.</p>
            
            <div className={styles.formGrid}>
              <div className="form-group">
                <label className="form-label">Bill Title</label>
                <input type="text" className="input-field" name="billTitle" value={formData.billTitle} onChange={handleInputChange} required />
              </div>
              
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input type="text" className="input-field" name="businessName" value={formData.businessName} onChange={handleInputChange} required />
              </div>

              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label className="form-label">Business Address</label>
                <input type="text" className="input-field" name="businessAddress" value={formData.businessAddress} onChange={handleInputChange} required />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Number</label>
                <input type="text" className="input-field" name="businessContact" value={formData.businessContact} onChange={handleInputChange} />
              </div>

              <div className="form-group">
                <label className="form-label">PAN/VAT No.</label>
                <input type="text" className="input-field" name="panVatNo" value={formData.panVatNo} onChange={handleInputChange} />
              </div>
              
              <div className="form-group">
                <label className="form-label">Default VAT %</label>
                <input type="number" step="0.01" min="0" max="100" className="input-field" name="vatPercentage" value={formData.vatPercentage} onChange={handleInputChange} required />
              </div>
            </div>
          </div>

          {/* Unit & Fiscal Year */}
          <div className={`${styles.card} glass-panel`}>
            <h2 className="heading-2">Configuration</h2>
            <p className={styles.description}>Manage default units and fiscal year boundaries.</p>
            
            <div className={styles.configGrid}>
              <div>
                <label className="form-label"><Calendar size={16} style={{display:'inline', marginBottom:'-2px'}}/> Fiscal Year Setup</label>
                <div className={styles.fiscalBox}>
                  <div className="form-group">
                    <label className="form-label" style={{fontSize: '0.75rem'}}>Start Month</label>
                    <select className="input-field" name="fiscalYearStartMonth" value={formData.fiscalYearStartMonth} onChange={handleInputChange}>
                      <option value="Baisakh">Baisakh</option>
                      <option value="Shrawan">Shrawan</option>
                      <option value="Mangsir">Mangsir</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{fontSize: '0.75rem'}}>End Month</label>
                    <select className="input-field" name="fiscalYearEndMonth" value={formData.fiscalYearEndMonth} onChange={handleInputChange}>
                      <option value="Ashadh">Ashadh</option>
                      <option value="Chaitra">Chaitra</option>
                      <option value="Kartik">Kartik</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Unit Categories</label>
                <div className={styles.unitList}>
                  {formData.units.map(unit => (
                    <div key={unit} className={styles.unitItem}>
                      {unit}
                      <button type="button" onClick={() => handleRemoveUnit(unit)} className={styles.unitDelBtn}><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
                <div className={styles.addUnitBox}>
                  <input type="text" className="input-field" placeholder="Add unit (e.g. Box)" value={newUnit} onChange={(e)=>setNewUnit(e.target.value)} />
                  <button type="button" className="btn-secondary" onClick={handleAddUnit}><Plus size={16}/></button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.columnRight}>
          
          {/* Action PIN */}
          <div className={`${styles.card} glass-panel`}>
            <div className={styles.cardHeaderIcon}>
              <Lock size={24} className={styles.iconWarning} />
              <h2 className="heading-2" style={{marginBottom: 0}}>Action PIN</h2>
            </div>
            <p className={styles.description}>Protect Edit and Delete actions across the app with a 4-digit PIN.</p>
            <div className="form-group">
                <label className="form-label">Security PIN (4 Digits)</label>
                {originalPin && !isPinUnlocked ? (
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <input 
                      type="password" 
                      className="input-field" 
                      value="****" 
                      disabled
                      style={{flex: 1}}
                    />
                    <button type="button" className="btn-secondary" onClick={() => setPinModalOpen(true)}>Modify</button>
                  </div>
                ) : (
                  <div style={{position: 'relative'}}>
                    <input 
                      type={showPin ? "text" : "password"}
                      className="input-field" 
                      name="actionPin" 
                      value={formData.actionPin} 
                      onChange={handleInputChange} 
                      placeholder="Leave blank to disable"
                      pattern="\d*"
                      maxLength="4"
                      autoFocus={isPinUnlocked}
                      style={{paddingRight: '2.5rem'}}
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
                      {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                )}
              </div>
          </div>

          {/* Backup & Export */}
          <div className={`${styles.card} glass-panel`}>
            <div className={styles.cardHeaderIcon}>
              <Download size={24} className={styles.iconPrimary} />
              <h2 className="heading-2" style={{marginBottom: 0}}>Data Backup</h2>
            </div>
            <p className={styles.description}>Export all your records, stock, and customer data to an Excel file (.xlsx) or configure automatic backups.</p>
            
            <div className="form-group" style={{marginTop: '1rem'}}>
              <label className="form-label" style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                <FolderOpen size={16} /> Backup Destination Folder
              </label>
              <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                <div style={{
                  flex: 1, padding: '0.6rem 0.8rem', background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', borderRadius: '0.4rem', 
                  fontSize: '0.85rem', color: backupFolder ? 'var(--text-primary)' : 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {backupFolder ? `Selected: ${backupFolder}` : 'Choose where backups will be saved'}
                </div>
                <button type="button" className="btn-secondary" onClick={handleSelectFolder} style={{whiteSpace: 'nowrap'}}>
                  Choose Folder
                </button>
              </div>
            </div>

            <div className="form-group" style={{marginTop: '1rem'}}>
              <label className="form-label">Automatic Backup Reminder</label>
              <div style={{display: 'flex', gap: '0.75rem'}}>
                <select className="input-field" name="backupReminderFrequency" value={formData.backupReminderFrequency} onChange={handleInputChange} style={{flex: 1}}>
                  <option value="never">Never</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {formData.backupReminderFrequency !== 'never' && (
                  <input 
                    type="time" 
                    className="input-field" 
                    name="backupReminderTime" 
                    value={formData.backupReminderTime} 
                    onChange={handleInputChange} 
                    style={{width: '120px'}}
                    required
                  />
                )}
              </div>
              <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem'}}>
                You will receive a notification to back up your data based on this frequency.
              </p>
            </div>

            <button type="button" className="btn-primary" onClick={handleExport} disabled={exporting} style={{width: '100%', justifyContent: 'center', marginTop: '1.5rem'}}>
              <Download size={18} /> {exporting ? 'Exporting...' : 'Export Now (Manual Backup)'}
            </button>
          </div>


          {/* App Installation */}
          <div className={`${styles.card} glass-panel`}>
            <div className={styles.cardHeaderIcon}>
              <Smartphone size={24} className={styles.iconPrimary} />
              <h2 className="heading-2" style={{marginBottom: 0}}>Install App</h2>
            </div>
            <p className={styles.description}>Install VAT Bill as an app on your device for quick access and a better experience.</p>
            
            {isAppInstalled ? (
              <div className={styles.sessionBox} style={{marginTop: '1rem', justifyContent: 'center'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600}}>
                  <CheckCircle size={18} /> App Installed
                </div>
              </div>
            ) : (
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleInstallClick}
                style={{width: '100%', justifyContent: 'center', marginTop: '1rem'}}
              >
                <Smartphone size={18} /> Install App
              </button>
            )}
            {!deferredPrompt && !isAppInstalled && (
              <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.5rem'}}>
                Installation may not be available on this browser or device.
              </p>
            )}
          </div>
          
          <div className={styles.formActions}>
            <button type="submit" className="btn-primary" disabled={loading} style={{width: '100%', padding: '1rem', fontSize: '1.1rem'}}>
              <Save size={20} /> {loading ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
          
        </div>

      </form>

      {/* Device Sessions & Security - full width below form */}
      <div className={`${styles.card} glass-panel`} style={{marginTop: '1.5rem'}}>
        <div className={styles.cardHeaderIcon}>
          <Shield size={24} className={styles.iconPrimary} />
          <h2 className="heading-2" style={{marginBottom: 0}}>Device Sessions & Security</h2>
        </div>
        <p className={styles.description}>View and manage devices where you're currently logged in. You can revoke access from unfamiliar devices for security.</p>

        {/* Change Password row */}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem'}}>
          <span style={{fontWeight: 600}}>Change Password</span>
          <button type="button" className="btn-secondary" onClick={() => setChangePwdOpen(true)} style={{gap: '0.4rem'}}>
            <Key size={16} /> Change Password
          </button>
        </div>

        {/* Active Sessions Header */}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
          <h3 style={{fontWeight: 700, fontSize: '1rem', margin: 0}}>
            Active Device Sessions ({sessions.length})
          </h3>
          {sessions.length > 1 && (
            <button type="button" onClick={handleLogoutAllOther} style={{background: 'none', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', padding: 0}}>
              Logout All Other Devices
            </button>
          )}
        </div>
        <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 1rem'}}>
          These are the devices currently logged into your account. Revoke access from unfamiliar devices.
        </p>

        {/* Sessions List */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto'}}>
          {sessions.length === 0 ? (
            <p style={{color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem'}}>No active sessions found.</p>
          ) : sessions.map(s => {
            const isCurrent = s.id === sessionId;
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.9rem 1rem', borderRadius: '0.6rem',
                border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                background: 'var(--bg-secondary)'
              }}>
                <div style={{
                  background: isCurrent ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary, var(--bg-primary))',
                  borderRadius: '0.5rem', padding: '0.6rem',
                  color: isCurrent ? 'var(--primary)' : 'var(--text-secondary)', flexShrink: 0
                }}>
                  {(s.deviceType === 'iOS' || s.deviceType === 'Android') ? <Smartphone size={20} /> : <Monitor size={20} />}
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap'}}>
                    <span style={{fontWeight: 700, fontSize: '0.95rem'}}>{s.deviceType} - {s.deviceVersion}</span>
                    {isCurrent && (
                      <span style={{
                        background: 'var(--primary)', color: '#fff',
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
                        padding: '0.15rem 0.5rem', borderRadius: '999px', textTransform: 'uppercase'
                      }}>Current Device</span>
                    )}
                  </div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                    <Clock size={12} /> Last active {s.lastActive ? new Date(s.lastActive).toLocaleString() : 'Unknown'}
                  </div>
                </div>
                {!isCurrent && (
                  <button type="button" onClick={() => handleRevokeSession(s.id)} title="Revoke session"
                    style={{ background: 'var(--bg-tertiary, var(--border-color))', border: 'none', borderRadius: '0.4rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', transition: 'background 0.2s, color 0.2s', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary, var(--border-color))'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ActionPinModal 
        isOpen={pinModalOpen} 
        onClose={() => setPinModalOpen(false)} 
        onSuccess={() => {
          setPinModalOpen(false);
          setIsPinUnlocked(true);
        }} 
        requiredPin={originalPin}
        actionName="modify your Security PIN"
      />
      <ChangePasswordModal isOpen={changePwdOpen} onClose={() => setChangePwdOpen(false)} />
    </div>
  );
};

export default Settings;
