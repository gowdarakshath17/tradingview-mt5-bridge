import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, subscribeToAuth, logOut } from '../lib/firebase';
import { UserProfile, BridgeConfig, Signal } from '../types';
import { toast } from 'react-hot-toast';

export function useAuth(
  setConfig: (config: BridgeConfig) => void,
  setSignals: (signals: Signal[]) => void,
  defaultConfig: BridgeConfig
) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
      if (currentUser) {
        loadUserProfile(currentUser);
        loadUserDataFromFirestore(currentUser);
      } else {
        setProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserProfile = async (currentUser: FirebaseUser) => {
    const userEmailClean = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
    const isAdminUser = userEmailClean === 'gowdarakshath17@gmail.com';

    if (!db) {
      toast.error('No database connection available. Operating in limited offline mode.');
      setProfile(createOfflineProfile(currentUser));
      return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        
        if (isAdminUser) {
          const defaultFirstName = data.firstName || "Gowda";
          const defaultLastName = data.lastName || "Rakshath";
          const defaultDisplayName = (data.displayName && data.displayName !== "Trader" && data.displayName !== "Demo Trader") 
            ? data.displayName 
            : "Gowda Rakshath";
          const defaultPhone = data.phoneNumber || "+91 98765 43210";

          const updatedProfile: UserProfile = {
            ...data,
            firstName: defaultFirstName,
            lastName: defaultLastName,
            displayName: defaultDisplayName,
            phoneNumber: defaultPhone,
            isAdmin: true,
            approved: true,
            maxAccounts: Math.max(data.maxAccounts || 10, 10),
            role: 'admin'
          };

          // Always sync default admin details and permissions to Firestore
          await setDoc(userRef, {
            firstName: defaultFirstName,
            lastName: defaultLastName,
            displayName: defaultDisplayName,
            phoneNumber: defaultPhone,
            isAdmin: true,
            approved: true,
            maxAccounts: Math.max(data.maxAccounts || 10, 10),
            role: 'admin',
            updatedAt: new Date().toISOString()
          }, { merge: true });

          setProfile(updatedProfile);
        } else {
          setProfile(data);
        }
      } else {
        const rawName = (currentUser.displayName && currentUser.displayName !== "Trader")
          ? currentUser.displayName
          : (isAdminUser ? "Gowda Rakshath" : "Trader");
        const nameParts = rawName.split(" ");
        const firstName = isAdminUser ? "Gowda" : (nameParts[0] || "");
        const lastName = isAdminUser ? "Rakshath" : (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");
        const phone = isAdminUser ? "+91 98765 43210" : "";

        const profileData: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: rawName,
          firstName: firstName,
          lastName: lastName,
          phoneNumber: phone,
          photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(rawName)}`,
          approved: isAdminUser ? true : false,
          maxAccounts: isAdminUser ? 10 : 1,
          isAdmin: isAdminUser,
          role: isAdminUser ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        try {
          await setDoc(userRef, profileData, { merge: true });
        } catch (fsErr) {
          console.warn("Could not save initial user profile to Firestore:", fsErr);
        }
        setProfile(profileData);
      }
    } catch (err) {
      console.warn("Failed to load user profile:", err);
      toast.error('Network error. Offline fallback activated with restricted access.');
      setProfile(createOfflineProfile(currentUser));
    }
  };

  const createOfflineProfile = (currentUser: FirebaseUser): UserProfile => {
    const userEmailClean = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
    const isAdminUser = userEmailClean === 'gowdarakshath17@gmail.com';
    const rawName = (currentUser.displayName && currentUser.displayName !== "Trader") 
      ? currentUser.displayName 
      : (isAdminUser ? "Gowda Rakshath" : "Trader");
    const nameParts = rawName.split(" ");
    
    return {
      uid: currentUser.uid,
      email: currentUser.email || 'gowdarakshath17@gmail.com',
      displayName: rawName,
      firstName: isAdminUser ? "Gowda" : (nameParts[0] || ""),
      lastName: isAdminUser ? "Rakshath" : (nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""),
      phoneNumber: isAdminUser ? "+91 98765 43210" : "",
      photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(rawName)}`,
      approved: isAdminUser ? true : true,
      maxAccounts: isAdminUser ? 10 : 1,
      isAdmin: isAdminUser,
      role: isAdminUser ? 'admin' : 'user'
    };
  };

  const loadUserDataFromFirestore = async (currentUser: FirebaseUser) => {
    if (!db) return;
    try {
      const configRef = doc(db, 'users', currentUser.uid, 'configs', 'bridgeConfig');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const loadedConfig = configSnap.data() as BridgeConfig;
        setConfig(loadedConfig);

        // Ensure user document has passphrase saved along with email
        if (loadedConfig.passphrase) {
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, {
              passphrase: loadedConfig.passphrase,
              email: currentUser.email || '',
              updatedAt: new Date().toISOString()
            }, { merge: true });

            setProfile(prev => prev ? { ...prev, passphrase: loadedConfig.passphrase } : prev);
          } catch (passErr) {
            console.warn("Failed to sync passphrase to main user profile:", passErr);
          }
        }
      } else {
        await setDoc(configRef, defaultConfig);
      }

      const signalsRef = collection(db, 'users', currentUser.uid, 'signals');
      const querySnap = await getDocs(signalsRef);
      const userSignals: Signal[] = [];
      querySnap.forEach((docSnap) => {
        userSignals.push(docSnap.data() as Signal);
      });
      if (userSignals.length > 0) {
        userSignals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setSignals(userSignals);
      }
    } catch (err) {
      console.warn("Failed to sync data with Firestore:", err);
    }
  };

  const handleSignIn = () => {
    setAuthError(null);
    setShowAuthModal(true);
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setUser(null);
      setProfile(null);
      toast.success('Successfully signed out');
    } catch (err) {
      console.error("Sign out failed:", err);
      toast.error('Sign out failed');
    }
  };

  return {
    user,
    setUser,
    profile,
    setProfile,
    authChecking,
    authError,
    setAuthError,
    showAuthModal,
    setShowAuthModal,
    handleSignIn,
    handleSignOut,
    loadUserProfile
  };
}
