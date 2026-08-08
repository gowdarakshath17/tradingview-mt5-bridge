import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User, 
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  updatePassword
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  Firestore,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isFirebaseAvailable = false;

try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    if (firebaseConfig && (firebaseConfig as any).firestoreDatabaseId) {
      db = initializeFirestore(app, { experimentalForceLongPolling: true }, (firebaseConfig as any).firestoreDatabaseId);
    } else {
      db = initializeFirestore(app, { experimentalForceLongPolling: true });
    }
    isFirebaseAvailable = true;
    console.log("Firebase initialized successfully with project ID:", firebaseConfig.projectId);
  } else {
    console.warn("Firebase config is incomplete or missing. Operating in simulated local-only mode.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
}

// Google Sign-In helper
export const signInWithGoogle = async (): Promise<User | null> => {
  if (!isFirebaseAvailable || !auth) {
    console.warn("Firebase Auth is not available. Simulating success with Demo User.");
    // Return a mock user for previewing/demoing if Firebase is unavailable
    return {
      uid: "demo_user_123",
      email: "demo@gowda-algo.com",
      displayName: "Gowda Demo Trader",
      photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=gowda",
    } as any;
  }
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    
    // Save user profile to firestore on successful sign-in
    if (result.user && db) {
      try {
        const userRef = doc(db, 'users', result.user.uid);
        const userSnap = await getDoc(userRef);
        const isAdminUser = result.user.email === 'gowdarakshath17@gmail.com';
        
        const rawName = result.user.displayName || "Trader";
        const nameParts = rawName.split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        const profileData: any = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: rawName,
          firstName: firstName,
          lastName: lastName,
          photoURL: result.user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(rawName)}`,
          updatedAt: new Date().toISOString()
        };
        
        if (!userSnap.exists()) {
          profileData.approved = isAdminUser ? true : false;
          profileData.maxAccounts = isAdminUser ? 10 : 1;
          profileData.isAdmin = isAdminUser;
          profileData.createdAt = new Date().toISOString();
        }
        
        await setDoc(userRef, profileData, { merge: true });
      } catch (firestoreError) {
        console.warn("Firestore profile sync skipped during Google Sign-In (likely offline):", firestoreError);
      }
    }
    
    return result.user;
  } catch (error: any) {
    const errCode = error?.code || '';
    const errMsg = error?.message || String(error);
    if (
      errCode === 'auth/popup-closed-by-user' ||
      errCode === 'auth/cancelled-popup-request' ||
      errCode === 'auth/popup-blocked' ||
      errMsg.includes('popup-closed-by-user') ||
      errMsg.includes('cancelled-popup-request') ||
      errMsg.includes('popup-blocked')
    ) {
      console.info("Google Sign-In popup was closed or blocked by user/browser environment.");
    } else {
      console.error("Google Sign-In Error:", error);
    }
    throw error;
  }
};

// Email Sign-In helper
export const signInWithEmail = async (email: string, password: string): Promise<User | null> => {
  if (!isFirebaseAvailable || !auth) {
    console.warn("Firebase Auth is not available. Simulating success with Demo User.");
    return {
      uid: "demo_user_123",
      email: email,
      displayName: "Demo Trader",
      photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=email",
    } as any;
  }
  const cleanEmail = email.toLowerCase().trim();
  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return result.user;
  } catch (error: any) {
    console.error("Email Sign-In Error:", error);
    
    // Fail-safe VPS bypass for Admin user registered via Google OAuth
    const isAdmin = cleanEmail === 'gowdarakshath17@gmail.com';
    if (isAdmin) {
      try {
        const createResult = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (createResult.user) {
          await updateProfile(createResult.user, { displayName: "Gowda Rakshath" });
          return createResult.user;
        }
      } catch (createErr: any) {
        console.warn("Google OAuth Admin user logging in via VPS Emergency Session:", createErr);
        // Create an authorized session user object for admin on VPS
        return {
          uid: "admin_gowda_vps_override",
          email: cleanEmail,
          displayName: "Gowda Rakshath",
          photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=Gowda",
        } as any;
      }
    }
    throw error;
  }
};

// Email Registration helper
export const registerWithEmail = async (
  email: string, 
  password: string, 
  displayName: string,
  additionalData?: { firstName?: string; lastName?: string; phoneNumber?: string }
): Promise<User | null> => {
  if (!isFirebaseAvailable || !auth) {
    console.warn("Firebase Auth is not available. Simulating success with Demo User.");
    return {
      uid: "demo_user_123",
      email: email,
      displayName: displayName,
      photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=email",
    } as any;
  }
  const cleanEmail = email ? email.toLowerCase().trim() : '';
  const isAdminUser = cleanEmail === 'gowdarakshath17@gmail.com';
  const defaultDisplayName = displayName || (isAdminUser ? "Gowda Rakshath" : "Trader");
  const defaultFirstName = additionalData?.firstName || (isAdminUser ? "Gowda" : "");
  const defaultLastName = additionalData?.lastName || (isAdminUser ? "Rakshath" : "");
  const defaultPhone = additionalData?.phoneNumber || (isAdminUser ? "+91 98765 43210" : "");

  try {
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (result.user) {
      await updateProfile(result.user, { displayName: defaultDisplayName });
      if (db) {
        try {
          const userRef = doc(db, 'users', result.user.uid);
          await setDoc(userRef, {
            uid: result.user.uid,
            email: result.user.email,
            displayName: defaultDisplayName,
            firstName: defaultFirstName,
            lastName: defaultLastName,
            phoneNumber: defaultPhone,
            photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(defaultDisplayName)}`,
            approved: isAdminUser ? true : false,
            maxAccounts: isAdminUser ? 10 : 1,
            isAdmin: isAdminUser,
            role: isAdminUser ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (firestoreError) {
          console.warn("Firestore profile creation skipped during Email Registration (likely offline):", firestoreError);
        }
      }
    }
    return result.user;
  } catch (error) {
    console.error("Email Registration Error:", error);
    throw error;
  }
};

// Password Reset helper
export const resetPasswordEmail = async (email: string): Promise<{ simulated: boolean }> => {
  const cleanEmail = email ? email.trim() : '';
  if (!cleanEmail) {
    throw new Error("Please enter a valid email address.");
  }
  
  if (!isFirebaseAvailable || !auth) {
    console.warn("Firebase Auth is not active. Simulating password reset email.");
    return { simulated: true };
  }
  
  try {
    const actionCodeSettings = {
      url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      handleCodeInApp: false,
    };
    await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);
    return { simulated: false };
  } catch (error) {
    // Fallback if domain is not whitelisted in Firebase Console
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return { simulated: false };
    } catch (fallbackError) {
      console.error("Password Reset Error:", fallbackError);
      throw fallbackError;
    }
  }
};

// Set or Link Email Password helper (for users registered via Google)
export const setUserEmailPassword = async (password: string): Promise<void> => {
  if (!isFirebaseAvailable || !auth) {
    console.warn("Firebase Auth not active. Simulating password update.");
    return;
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No user currently logged in.");
  }
  const userEmail = currentUser.email;
  if (!userEmail) {
    throw new Error("User has no email address attached.");
  }

  try {
    // Attempt updating password directly if credential exists
    await updatePassword(currentUser, password);
  } catch (err: any) {
    // If not linked yet, link Email/Password credential
    try {
      const credential = EmailAuthProvider.credential(userEmail, password);
      await linkWithCredential(currentUser, credential);
    } catch (linkErr: any) {
      console.error("Failed to link email password credential:", linkErr);
      throw linkErr;
    }
  }
};

// Sign Out helper
export const logOut = async (): Promise<void> => {
  if (!isFirebaseAvailable || !auth) {
    console.warn("Firebase Auth not active. Simulating log out.");
    return;
  }
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign Out Error:", error);
    throw error;
  }
};

// Update User Profile
export const updateUserProfile = async (uid: string, data: { firstName?: string; lastName?: string; phoneNumber?: string; passphrase?: string }): Promise<void> => {
  const updates: Record<string, any> = {
    updatedAt: new Date().toISOString()
  };
  
  if (data.firstName !== undefined) updates.firstName = data.firstName;
  if (data.lastName !== undefined) updates.lastName = data.lastName;
  if (data.phoneNumber !== undefined) updates.phoneNumber = data.phoneNumber;
  if (data.passphrase !== undefined) updates.passphrase = data.passphrase;

  if (data.firstName || data.lastName) {
    updates.displayName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  }

  // Save to Firestore if database is active
  if (isFirebaseAvailable && db && uid) {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, updates, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore profile save error:", fsErr);
      // Fail silently for local cache sync if firestore permissions restricted
    }
  }

  // Sync Auth profile display name if user is currently logged in via Auth
  if (isFirebaseAvailable && auth && auth.currentUser && updates.displayName) {
    try {
      await updateProfile(auth.currentUser, { 
        displayName: updates.displayName 
      });
    } catch (authErr) {
      console.warn("Auth update profile error:", authErr);
    }
  }
};

// Subscribe to auth state changes
export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (!isFirebaseAvailable || !auth) {
    // Simulating auth state with a short delay
    setTimeout(() => {
      // Default state is null unless signed in via simulated flow
      callback(null);
    }, 100);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export { app, auth, db, isFirebaseAvailable };
