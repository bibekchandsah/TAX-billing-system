import { useState, useRef, useEffect } from 'react';
import { Outlet, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { get } from 'idb-keyval';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package, 
  Settings, 
  LogOut,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Camera,
  Upload,
  Trash2
} from 'lucide-react';
import styles from './MainLayout.module.css';

const MainLayout = () => {
  const { user, profile, logout, updateProfilePhoto } = useAuthStore();
  const { theme, toggleTheme, sidebarOpen, toggleSidebar } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const profileRef = useRef(null);
  const fileInputRef = useRef(null);
  const backupRemindedRef = useRef(false);

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Max size is 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        await updateProfilePhoto(reader.result);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo.");
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile?.photoData) return;
    setIsUploading(true);
    try {
      await updateProfilePhoto(null);
      setIsUploading(false);
    } catch (error) {
      console.error("Error removing photo:", error);
      alert("Failed to remove photo.");
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const frequency = profile.backupReminderFrequency;
    if (!frequency || frequency === 'never') return;
    
    const time = profile.backupReminderTime || '17:00';
    const [hours, minutes] = time.split(':').map(Number);

    const checkBackupReminder = async () => {
      try {
        const lastBackup = await get('lastBackupTime');
        const now = new Date();
        
        const thresholdDays = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;
        const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
        const timeSinceBackup = lastBackup ? now.getTime() - lastBackup : Infinity;

        let shouldRemind = false;
        
        if (!lastBackup) {
          shouldRemind = true;
        } else {
          const nextReminder = new Date(lastBackup);
          if (frequency === 'daily') nextReminder.setDate(nextReminder.getDate() + 1);
          else if (frequency === 'weekly') nextReminder.setDate(nextReminder.getDate() + 7);
          else if (frequency === 'monthly') nextReminder.setMonth(nextReminder.getMonth() + 1);
          
          nextReminder.setHours(hours, minutes, 0, 0);
          
          if (now >= nextReminder) {
            shouldRemind = true;
          }
        }
        
        // Remind once per page load to ensure they see it, but don't spam intervals
        if (shouldRemind && !backupRemindedRef.current) {
          useAppStore.getState().addToast('Backup Reminder: It is time to back up your data. Please go to Settings > Data Backup.', 'info', false);
          backupRemindedRef.current = true;
        }
      } catch (e) {
        console.error("Failed to check backup reminder", e);
      }
    };
    
    // Check immediately on load
    checkBackupReminder();
    
    // Check every minute if the app stays open
    const intervalId = setInterval(checkBackupReminder, 60000);
    return () => clearInterval(intervalId);
  }, [profile]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error(error);
    }
  };

  const navItems = [
    { path: '/', label: 'VAT Bill', icon: <FileText size={20} /> },
    { path: '/records', label: 'Records', icon: <LayoutDashboard size={20} /> },
    { path: '/ledger', label: 'Ledger', icon: <Users size={20} /> },
    { path: '/stock', label: 'Stock', icon: <Package size={20} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const currentNavItem = navItems.find(item => item.path === location.pathname);
  const pageTitle = currentNavItem ? currentNavItem.label : 'Dashboard';

  return (
    <div className={styles.layout}>
      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={toggleSidebar}></div>
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''} ${isCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-store" aria-hidden="true"><path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"></path><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"></path><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"></path></svg>
            </div>
            <span className={styles.logoText}>VAT Billing</span>
          </div>
          <button className={styles.closeBtn} onClick={toggleSidebar}>
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-tooltip={isCollapsed ? item.label : undefined}
              className={({ isActive }) => 
                isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
              }
              onClick={() => {
                if (window.innerWidth < 768) toggleSidebar();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.navItem} onClick={handleLogout} data-tooltip={isCollapsed ? 'Logout' : undefined}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuBtn} onClick={() => {
              if (window.innerWidth >= 768) {
                setIsCollapsed(!isCollapsed);
              } else {
                toggleSidebar();
              }
            }}>
              <Menu size={24} />
            </button>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
          </div>
          
          <div className={styles.topbarRight}>
            <button className={styles.themeBtn} onClick={toggleTheme} title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}>
              {theme === 'light' && <Sun size={20} />}
              {theme === 'dark' && <Moon size={20} />}
              {theme === 'system' && <Monitor size={20} />}
            </button>
            <div className={styles.userProfileWrapper} ref={profileRef}>
              <button 
                className={styles.userProfileBtn} 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                <div className={styles.avatar}>
                  {profile?.photoData ? (
                    <img src={profile.photoData} alt="Profile" className={styles.avatarImg} />
                  ) : (
                    user.email ? user.email[0].toUpperCase() : 'U'
                  )}
                </div>
                {isProfileOpen ? <ChevronUp size={16} className={styles.caret} /> : <ChevronDown size={16} className={styles.caret} />}
              </button>

              {isProfileOpen && (
                <div className={styles.profileDropdown}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownAvatar}>
                      {profile?.photoData ? (
                        <img src={profile.photoData} alt="Profile" className={styles.avatarImg} />
                      ) : (
                        user.email ? user.email[0].toUpperCase() : 'U'
                      )}
                    </div>
                    <div className={styles.dropdownUserInfo}>
                      <span className={styles.dropdownName}>{profile?.businessName || user.email.split('@')[0]}</span>
                      <span className={styles.dropdownEmail}>{user.email}</span>
                    </div>
                  </div>
                  
                  <div className={styles.dropdownDivider}></div>
                  
                  <button className={styles.dropdownItem} onClick={() => { setIsPhotoModalOpen(true); setIsProfileOpen(false); }}>
                    <Camera size={18} />
                    <span>Change Photo</span>
                  </button>
                  
                  <div className={styles.dropdownDivider}></div>
                  
                  <button className={`${styles.dropdownItem} ${styles.dangerItem}`} onClick={handleLogout}>
                    <LogOut size={18} />
                    <span>Sign out</span>
                  </button>
                  
                  <div className={styles.dropdownDivider}></div>
                  
                  <a 
                    href="https://www.bibekchandsah.com.np/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={styles.dropdownFooter}
                  >
                    <img 
                      src="https://bibekchandsah.github.io/kiitcse/assets/image/developer.jpg" 
                      alt="Developer" 
                      className={styles.developerImg} 
                    />
                    <span className={styles.developerText}>Developed by Bibek</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>

      {/* Profile Photo Modal */}
      {isPhotoModalOpen && (
        <div className={styles.modalOverlay} onClick={() => !isUploading && setIsPhotoModalOpen(false)}>
          <div className={styles.photoModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Profile Photo</h2>
              <button className={styles.closeModalBtn} onClick={() => setIsPhotoModalOpen(false)} disabled={isUploading}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.largeAvatarWrapper}>
                <div className={styles.largeAvatar}>
                  {profile?.photoData ? (
                    <img src={profile.photoData} alt="Profile" className={styles.largeAvatarImg} />
                  ) : (
                    user.email ? user.email[0].toUpperCase() : 'U'
                  )}
                </div>
                <div 
                  className={styles.cameraBadge}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                >
                  <Camera size={16} />
                </div>
              </div>
              
              <div className={styles.modalName}>{profile?.businessName || user.email.split('@')[0]}</div>
              <div className={styles.modalEmail}>{user.email}</div>
              
              <div className={styles.modalActions}>
                <button 
                  className={styles.uploadBtn} 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload size={18} />
                  <span>Upload Photo</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handlePhotoUpload} 
                  accept="image/png, image/jpeg, image/webp, image/gif" 
                  style={{ display: 'none' }} 
                />
                <button 
                  className={styles.removeBtn} 
                  onClick={handleRemovePhoto}
                  disabled={isUploading || !profile?.photoData}
                >
                  <Trash2 size={18} />
                  <span>Remove Photo</span>
                </button>
              </div>
              
              <div className={styles.photoHelpText}>
                JPG, PNG, WebP · Max 5 MB · GIF / Animated PNG · Max 700 KB
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
