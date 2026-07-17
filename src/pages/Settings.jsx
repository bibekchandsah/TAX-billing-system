import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { getSettings, updateSettings } from '../services/db';
import { generateExcelBackup } from '../services/backup';
import { Save, LogOut, Shield, Download, Lock, Calendar, Plus, Trash2, Edit2, Smartphone, CheckCircle, Eye, EyeOff } from 'lucide-react';
import ActionPinModal from '../components/ActionPinModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { db } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Key, Monitor, Clock } from 'lucide-react';
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
    fiscalYearEndMonth: 'Ashadh'
  });

  const [newUnit, setNewUnit] = useState('');

  const [originalPin, setOriginalPin] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsAppInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

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

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("Installation prompt is not ready. You can still install the app directly from your browser's address bar or menu (e.g., 'Add to Home Screen').");
    }
  };

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
            <p className={styles.description}>Export all your records, stock, and customer data to an Excel file (.xlsx).</p>
            
            <button type="button" className="btn-secondary" onClick={handleExport} disabled={exporting} style={{width: '100%', justifyContent: 'center', marginTop: '1rem'}}>
              <Download size={18} /> {exporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          </div>

          {/* Security & Sessions */}
          <div className={`${styles.card} glass-panel`}>
            <div className={styles.cardHeaderIcon}>
              <Shield size={24} className={styles.iconPrimary} />
              <h2 className="heading-2" style={{marginBottom: 0}}>Security & Sessions</h2>
            </div>
            <p className={styles.description}>Manage your active devices and account security.</p>
            
            <div className={styles.sessionBox}>
              <div className={styles.sessionInfo}>
                <div className={styles.sessionName}>Current Session</div>
                <div className={styles.sessionDetails}>{user?.email}</div>
              </div>
              <span className={styles.badgeSuccess}>Active Now</span>
            </div>

            <button type="button" className="btn-danger" onClick={logout} style={{width: '100%', justifyContent: 'center', marginTop: '1.5rem'}}>
              <LogOut size={18} /> Sign Out of All Devices
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
    </div>
  );
};

export default Settings;
