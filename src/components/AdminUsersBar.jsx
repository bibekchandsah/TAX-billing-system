import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store/authStore';
import { createPortal } from 'react-dom';
import styles from './AdminUsersBar.module.css';

const AdminUsersBar = () => {
  const { user, profile, isAdmin, activeUid, setActiveUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredUser, setHoveredUser] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    
    const unsubscribe = onSnapshot(collection(db, 'users'), (querySnapshot) => {
      const fetchedUsers = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedUsers.push({
          uid: doc.id,
          email: data.email || 'No Email',
          businessName: data.businessName || data.displayName || data.name || 'Unknown User',
          photoData: data.photoData || null,
        });
      });
      setUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users for admin bar:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <>
      <div className={styles.adminUsersBarContainer}>
        {/* Self Avatar */}
        <div 
          className={`${styles.adminUserAvatar} ${styles.adminSelfAvatar} ${activeUid === user?.uid ? styles.viewingActive : ''}`}
          onClick={() => setActiveUser(user?.uid, user?.email)}
          onMouseEnter={(e) => {
            setHoveredUser({
              displayName: 'Admin (Me)',
              email: user?.email || '',
              rect: e.currentTarget.getBoundingClientRect()
            });
          }}
          onMouseLeave={() => setHoveredUser(null)}
        >
          {profile?.photoData ? (
            <img src={profile.photoData} alt="Admin" />
          ) : (
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ME</span>
          )}
        </div>

        {/* Other Users */}
        {!loading && users.map((u) => {
          if (u.uid === user?.uid) return null;
          
          const isViewing = activeUid === u.uid;
          
          return (
            <div 
              key={u.uid} 
              className={`${styles.adminUserAvatar} ${isViewing ? styles.viewingActive : ''}`}
              onClick={() => setActiveUser(u.uid, u.email)}
              onMouseEnter={(e) => {
                setHoveredUser({
                  displayName: u.businessName,
                  email: u.email,
                  rect: e.currentTarget.getBoundingClientRect()
                });
              }}
              onMouseLeave={() => setHoveredUser(null)}
            >
              {u.photoData ? (
                <img 
                  src={u.photoData} 
                  alt={u.businessName} 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <span className={styles.avatarInitials} style={{ display: u.photoData ? 'none' : 'flex' }}>
                {u.businessName ? u.businessName.substring(0, 2).toUpperCase() : u.email.substring(0, 2).toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>

      {hoveredUser && createPortal(
        <div 
          className={styles.adminTooltipPortal} 
          style={{
            top: hoveredUser.rect.bottom + 14,
            left: hoveredUser.rect.left + hoveredUser.rect.width / 2,
            transform: 'translateX(-50%)'
          }}
        >
          <div className={styles.ttName}>{hoveredUser.displayName}</div>
          <div className={styles.ttEmail}>{hoveredUser.email}</div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AdminUsersBar;
