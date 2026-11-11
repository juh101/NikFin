
'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, Firestore } from 'firebase/firestore';
import { useAuth, useFirestore } from '../provider';

interface UserProfile {
  displayName?: string;
  email?: string;
  photoURL?: string;
  updatedAt?: any;
  createdAt?: any;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  displayName: string;
}

const UserContext = createContext<UserContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  displayName: 'Finance User'
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = useAuth();
  const db = useFirestore();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [auth]);

  useEffect(() => {
    if (!user || !db) return;

    setLoading(true);
    const userRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Profile listen error:", error);
      setLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user, db]);

  // Fallback logic for display name
  const effectiveDisplayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Finance User';

  return (
    <UserContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      displayName: effectiveDisplayName 
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
