"use client";

import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db, firebaseConfig, isFirebaseConfigured } from "@/lib/firebase";
import type { Role, UserProfile } from "@/types/domain";

const validRoles: Role[] = ["admin", "operador", "financeiro"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && validRoles.includes(value as Role);
}

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createUser: (payload: { nome: string; email: string; password: string; role: Role; fazenda_id?: string }) => Promise<string>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }

    return onAuthStateChanged(auth, async (currentUser) => {
      try {
        setUser(currentUser);

        if (!currentUser) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const snapshot = await getDoc(doc(db, "users", currentUser.uid));
        const data = snapshot.data() as Omit<UserProfile, "uid"> | undefined;

        if (!data || !isRole(data.role)) {
          setProfile(null);
          setLoading(false);
          await signOut(auth);
          return;
        }

        setProfile({
          uid: currentUser.uid,
          nome: data?.nome ?? currentUser.displayName ?? currentUser.email ?? "Usuário",
          email: data?.email ?? currentUser.email ?? "",
          role: data.role,
          fazenda_id: data?.fazenda_id
        });
      } catch {
        setUser(null);
        setProfile(null);
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      async login(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async logout() {
        await signOut(auth);
      },
      async createUser(payload) {
        if (!isRole(payload.role)) {
          throw new Error("Perfil de usuário inválido.");
        }

        const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        try {
          const credential = await createUserWithEmailAndPassword(secondaryAuth, payload.email, payload.password);
          await setDoc(doc(db, "users", credential.user.uid), {
            nome: payload.nome,
            email: payload.email,
            role: payload.role,
            fazenda_id: payload.fazenda_id ?? "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          return credential.user.uid;
        } finally {
          await signOut(secondaryAuth).catch(() => undefined);
          await deleteApp(secondaryApp);
        }
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email);
      }
    }),
    [loading, profile, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
