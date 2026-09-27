import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Translate Supabase error codes/messages into user-friendly text
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('email not confirmed') || m.includes('confirm') && m.includes('email')) {
    return 'Email not confirmed yet. Check your inbox for the confirmation link.';
  }
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'Wrong email or password.';
  }
  if (m.includes('user already registered') || m.includes('already exists') || m.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('over_email_send_rate_limit')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (m.includes('signup') && m.includes('disabled')) {
    return 'New signups are temporarily disabled. Please contact support.';
  }
  if (m.includes('weak password') || m.includes('password should be')) {
    return 'Password is too weak. Use at least 6 characters with letters and numbers.';
  }
  if (m.includes('invalid email') || m.includes('email_address_invalid')) {
    return 'Invalid email address.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const needsConfirmation = error.message.toLowerCase().includes('email not confirmed') ||
                                 (error as any).code === 'email_not_confirmed';
      return { error: friendlyError(error.message), needsConfirmation };
    }
    return { error: null, needsConfirmation: false };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // Where Supabase should redirect users after they click the email confirmation link
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      return { error: friendlyError(error.message), needsConfirmation: false };
    }

    // If user exists but identities is empty, it means email is already taken
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { error: 'An account with this email already exists. Try signing in.', needsConfirmation: false };
    }

    // No session means email confirmation is required
    const needsConfirmation = !data.session;
    return { error: null, needsConfirmation };
  }

  async function resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    return { error: error ? friendlyError(error.message) : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resendConfirmation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
