import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setVoiceOn } from '../lib/speech';

const AuthContext = createContext(null);

export const DEFAULT_PREFS = {
  default_priority: 'time',
  default_mode: 'transit',
  voice_enabled: true,
  save_favorites: false,
  favorites: [],
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) {
      setPrefs(null);
      return;
    }
    supabase
      .from('preferences')
      .select('default_priority, default_mode, voice_enabled, save_favorites, favorites')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        const p = data || DEFAULT_PREFS;
        setPrefs(p);
        setVoiceOn(p.voice_enabled);
      });
  }, [session]);

  const savePrefs = useCallback(
    async (patch) => {
      if (!supabase || !session?.user) throw new Error('Connectez-vous pour enregistrer vos préférences.');
      const next = { ...(prefs || DEFAULT_PREFS), ...patch };
      if (!next.save_favorites) next.favorites = [];
      const { error } = await supabase.from('preferences').upsert({ user_id: session.user.id, ...next });
      if (error) throw new Error(error.message);
      setPrefs(next);
      setVoiceOn(next.voice_enabled);
      return next;
    },
    [prefs, session],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw new Error(error.message);
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ enabled: Boolean(supabase), ready, session, user: session?.user || null, prefs, savePrefs, signOut, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
