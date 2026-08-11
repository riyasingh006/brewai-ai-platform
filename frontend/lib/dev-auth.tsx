"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getAuthToken, getDevEmail, setAuthToken, setDevEmail } from "./api";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, name?: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  adminLogin: (email: string, password: string, adminKey: string) => Promise<boolean>;
  adminRegister: (
    email: string,
    password: string,
    adminKey: string,
    name?: string,
  ) => Promise<boolean>;
  signOut: () => void;
  devEmail: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

function applySession(result: { user: User; token: string }) {
  setAuthToken(result.token);
  return result.user;
}

export function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devEmail, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const stored = getDevEmail();
    const token = getAuthToken();
    const email = token ? null : stored;
    if (!email) {
      if (!token) {
        setLoading(false);
        return;
      }
      api
        .me(null)
        .then(setUser)
        .catch(() => {
          setUser(null);
          setAuthToken(null);
        })
        .finally(() => setLoading(false));
      return;
    }
    setEmail(email);
    api
      .me(email)
      .then(setUser)
      .catch(() => {
        setUser(null);
        window.localStorage.removeItem("brewai.dev_email");
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, name?: string): Promise<boolean> => {
    setError(null);
    const value = email.trim();
    if (!value || !value.includes("@")) {
      setError("Enter a valid email address.");
      return false;
    }
    setDevEmail(value);
    setEmail(value);
    try {
      if (name && name.trim()) {
        await api.updateProfile(value, { name: name.trim() });
      }
      const me = await api.me(value);
      setUser(me);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
      window.localStorage.removeItem("brewai.dev_email");
      setUser(null);
      return false;
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      const result = await api.login(email, password);
      setUser(applySession(result));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
      return false;
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string): Promise<boolean> => {
      setError(null);
      try {
        const result = await api.register(email, password, name);
        setUser(applySession(result));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create your account.");
        return false;
      }
    },
    [],
  );

  const adminLogin = useCallback(
    async (email: string, password: string, adminKey: string): Promise<boolean> => {
      setError(null);
      try {
        const result = await api.adminLogin(email, password, adminKey);
        setUser(applySession(result));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not sign in as admin.");
        return false;
      }
    },
    [],
  );

  const adminRegister = useCallback(
    async (
      email: string,
      password: string,
      adminKey: string,
      name?: string,
    ): Promise<boolean> => {
      setError(null);
      try {
        const result = await api.adminRegister(email, password, adminKey, name);
        setUser(applySession(result));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create the admin account.");
        return false;
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    window.localStorage.removeItem("brewai.dev_email");
    setAuthToken(null);
    setUser(null);
    setEmail(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      signIn,
      login,
      register,
      adminLogin,
      adminRegister,
      signOut,
      devEmail,
    }),
    [
      user,
      loading,
      error,
      signIn,
      login,
      register,
      adminLogin,
      adminRegister,
      signOut,
      devEmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within DevAuthProvider");
  return ctx;
}
