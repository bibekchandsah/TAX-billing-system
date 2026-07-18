import { create } from 'zustand';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { parseUserAgent } from '../utils/deviceParser';

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null, // Additional user info from Firestore
  loading: true,
  error: null,
  sessionId: null,
  unsubscribeSession: null,
  heartbeatInterval: null,

  initAuthListener: () => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        set({ user });
        
        // --- Session Management ---
        let sid = localStorage.getItem('vat_session_id');
        if (!sid) {
          sid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
          localStorage.setItem('vat_session_id', sid);
        }
        set({ sessionId: sid });

        const { os, browser } = parseUserAgent(navigator.userAgent);
        const sessionRef = doc(db, 'users', user.uid, 'sessions', sid);
        
        try {
          await setDoc(sessionRef, {
            deviceType: os,
            deviceVersion: browser,
            userAgent: navigator.userAgent,
            lastActive: new Date().toISOString()
          }, { merge: true });

          // Listen to session changes/deletions
          const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
            if (!snapshot.exists()) {
              // Session was revoked
              const state = get();
              if (state.user && state.user.uid === user.uid) {
                console.warn('Session revoked from another device. Logging out...');
                signOut(auth);
              }
            }
          }, (err) => {
            console.error('Session listener error:', err);
          });
          set({ unsubscribeSession: unsubscribe });

          // Heartbeat: update lastActive every 5 minutes
          const heartbeat = setInterval(async () => {
            try {
              await setDoc(sessionRef, { lastActive: new Date().toISOString() }, { merge: true });
            } catch(e) {}
          }, 5 * 60 * 1000);
          set({ heartbeatInterval: heartbeat });
        } catch (e) {
          console.error('Failed to register session', e);
        }
        
        // Fetch profile
        try {
          const profileDoc = await getDoc(doc(db, 'users', user.uid));
          if (profileDoc.exists()) {
            set({ profile: profileDoc.data() });
          }
        } catch (error) {
          console.error("Failed to fetch profile", error);
        }
      } else {
        const { unsubscribeSession, heartbeatInterval } = get();
        if (unsubscribeSession) unsubscribeSession();
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        set({ user: null, profile: null, sessionId: null, unsubscribeSession: null, heartbeatInterval: null });
      }
      set({ loading: false });
    });
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // user will be set by the auth listener
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  signup: async (email, password, businessName) => {
    set({ loading: true, error: null });
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Create user profile in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        businessName,
        createdAt: new Date().toISOString()
      });
      // Setup initial settings for this user
      await setDoc(doc(db, 'users', userCredential.user.uid, 'settings', 'profile'), {
        billTitle: 'TAX INVOICE',
        businessName: businessName,
        businessAddress: '',
        businessContact: '',
        panVatNo: '',
        vatPercentage: 13
      });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateProfilePhoto: async (photoData) => {
    const { user, profile } = get();
    if (!user) return;
    
    set({ loading: true, error: null });
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { photoData }, { merge: true });
      set({ profile: { ...profile, photoData }, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateProfileName: async (businessName) => {
    const { user, profile } = get();
    if (!user) return;
    
    set({ loading: true, error: null });
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { businessName }, { merge: true });
      
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'profile');
      await setDoc(settingsRef, { businessName }, { merge: true });
      
      set({ profile: { ...profile, businessName }, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  logout: async () => {
    set({ loading: true, error: null });
    try {
      const { user, sessionId, unsubscribeSession } = get();
      if (user && sessionId) {
        if (unsubscribeSession) unsubscribeSession();
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'sessions', sessionId));
        } catch (e) {}
      }
      await signOut(auth);
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },


  changePassword: async (oldPassword, newPassword) => {
    const { user } = get();
    if (!user) throw new Error("No user logged in");
    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (error) {
      throw error;
    }
  },

  revokeSession: async (sessionIdToRevoke) => {
    const { user } = get();
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'sessions', sessionIdToRevoke));
    } catch (error) {
      console.error("Failed to revoke session", error);
      throw error;
    }
  },

  logoutAllOtherDevices: async () => {
    const { user, sessionId } = get();
    if (!user || !sessionId) return;
    try {
      const sessionsSnap = await getDocs(collection(db, 'users', user.uid, 'sessions'));
      const batch = writeBatch(db);
      sessionsSnap.forEach(document => {
        if (document.id !== sessionId) {
          batch.delete(document.ref);
        }
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to logout other devices", error);
      throw error;
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      await sendPasswordResetEmail(auth, email);
      set({ loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user profile exists, if not create it
      const userRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: result.user.email,
          businessName: result.user.displayName || result.user.email.split('@')[0],
          photoData: result.user.photoURL,
          createdAt: new Date().toISOString()
        });
        
        // Setup initial settings
        await setDoc(doc(db, 'users', result.user.uid, 'settings', 'profile'), {
          billTitle: 'TAX INVOICE',
          businessName: result.user.displayName || result.user.email.split('@')[0],
          businessAddress: '',
          businessContact: '',
          panVatNo: '',
          vatPercentage: 13
        });
      }
      
      // user and profile state will be updated by auth listener
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  }
}));

