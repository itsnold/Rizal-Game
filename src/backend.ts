import { initializeApp } from 'firebase/app';
import { browserSessionPersistence, getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { getDatabase, get, onDisconnect, onValue, ref, serverTimestamp, set, update } from 'firebase/database';
import { demoSeed } from './demo';
import type { Identity } from './model';
import { durableTransaction } from './transactions';

type Unsubscribe = () => void;
type Updater<T> = (value: T | null) => T | undefined;
export interface Connection { connected: boolean; clockReady: boolean; offset: number }
export interface Backend {
  demo: boolean;
  configured: boolean;
  watch<T>(path: string, callback: (value: T | null) => void, error?: (error: Error) => void): Unsubscribe;
  read<T>(path: string): Promise<T | null>;
  write(path: string, value: unknown): Promise<void>;
  patch(values: Record<string, unknown>): Promise<void>;
  transact<T>(path: string, updater: Updater<T>): Promise<boolean>;
  watchAuth(callback: (identity: Identity | null) => void): Unsubscribe;
  login(groupNumber?: number): Promise<void>;
  logout(): Promise<void>;
  watchConnection(callback: (connection: Connection) => void): Unsubscribe;
  timestamp(): unknown;
  presence(path: string): Promise<Unsubscribe>;
}

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const isConfigured = Object.values(config).every(Boolean);
export const isDemo = new URLSearchParams(location.search).get('demo') === '1';

function firebaseBackend(): Backend {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const authReady = setPersistence(auth, browserSessionPersistence);
  const db = getDatabase(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  void getRedirectResult(auth).catch(error => { sessionStorage.setItem('rizal-auth-error', String(error.message)); });
  return {
    demo: false, configured: true,
    watch: (path, callback, error) => onValue(ref(db, path), snap => callback(snap.val()), error),
    read: async path => (await get(ref(db, path))).val(),
    write: (path, value) => set(ref(db, path), value),
    patch: values => update(ref(db), values),
    transact: (path, updater) => durableTransaction(db, path, updater),
    watchAuth: callback => onAuthStateChanged(auth, user => callback(user ? { uid: user.uid, email: user.email ?? '', name: user.displayName ?? 'Representative' } : null)),
    login: async () => {
      await authReady;
      try { await signInWithPopup(auth, provider); }
      catch (error) {
        if ((error as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(auth, provider);
        else throw error;
      }
    },
    logout: () => signOut(auth),
    watchConnection: callback => {
      const connection = { connected: false, clockReady: false, offset: 0 };
      const stopOffset = onValue(ref(db, '.info/serverTimeOffset'), snap => {
        connection.offset = snap.val() ?? 0;
        connection.clockReady = snap.exists();
        callback({ ...connection });
      });
      const stopConnected = onValue(ref(db, '.info/connected'), snap => {
        connection.connected = snap.val() === true;
        callback({ ...connection });
      });
      return () => { stopOffset(); stopConnected(); };
    },
    timestamp: serverTimestamp,
    presence: async path => {
      const node = ref(db, path);
      const disconnect = onDisconnect(node);
      await disconnect.remove();
      await set(node, true);
      return () => { void disconnect.cancel(); void set(node, null).catch(() => {}); };
    },
  };
}

const STORAGE_KEY = 'rizal-live-rehearsal-v1';
type JsonObject = Record<string, unknown>;
function localRoot(): JsonObject { return JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify(demoSeed())); }
function readPath(root: JsonObject, path: string): unknown {
  let node: unknown = root;
  for (const key of path.split('/').filter(Boolean)) node = node && typeof node === 'object' ? (node as JsonObject)[key] : null;
  return node ?? null;
}
function putPath(root: JsonObject, path: string, value: unknown) {
  const keys = path.split('/').filter(Boolean);
  let node = root;
  keys.slice(0, -1).forEach(key => {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key] as JsonObject;
  });
  if (value == null) delete node[keys.at(-1)!];
  else node[keys.at(-1)!] = value;
}
function persist(root: JsonObject) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  window.dispatchEvent(new Event('rizal-store'));
}
async function locked<T>(fn: () => T): Promise<T> {
  return navigator.locks ? navigator.locks.request('rizal-demo-write', fn) : fn();
}
function demoBackend(): Backend {
  if (!localStorage.getItem(STORAGE_KEY)) persist(demoSeed());
  const authListeners = new Set<(identity: Identity | null) => void>();
  let identity: Identity | null = JSON.parse(sessionStorage.getItem('rizal-demo-user') || 'null');
  return {
    demo: true, configured: true,
    watch: (path, callback) => {
      const notify = () => callback(readPath(localRoot(), path) as never);
      notify();
      window.addEventListener('storage', notify);
      window.addEventListener('rizal-store', notify);
      return () => { window.removeEventListener('storage', notify); window.removeEventListener('rizal-store', notify); };
    },
    read: async path => readPath(localRoot(), path) as never,
    write: async (path, value) => locked(() => { const root = localRoot(); putPath(root, path, value); persist(root); }),
    patch: async values => locked(() => { const root = localRoot(); Object.entries(values).forEach(([path, value]) => putPath(root, path, value)); persist(root); }),
    transact: async (path, updater) => locked(() => {
      const root = localRoot();
      const next = updater(readPath(root, path) as never);
      if (next === undefined) return false;
      putPath(root, path, next);
      persist(root);
      return true;
    }),
    watchAuth: callback => { authListeners.add(callback); callback(identity); return () => { authListeners.delete(callback); }; },
    login: async groupNumber => {
      identity = groupNumber ? { uid: `demo-rep-${groupNumber}`, email: `rep${groupNumber}@addu.edu.ph`, name: `Representative ${groupNumber}` } : { uid: 'demo-host', email: 'rsegundo@addu.edu.ph', name: 'Presenter' };
      sessionStorage.setItem('rizal-demo-user', JSON.stringify(identity));
      authListeners.forEach(callback => callback(identity));
    },
    logout: async () => { identity = null; sessionStorage.removeItem('rizal-demo-user'); authListeners.forEach(callback => callback(null)); },
    watchConnection: callback => { callback({ connected: true, clockReady: true, offset: 0 }); return () => {}; },
    timestamp: () => Date.now(),
    presence: async path => {
      const write = () => { const root = localRoot(); putPath(root, path, null); persist(root); };
      await locked(() => { const root = localRoot(); putPath(root, path, true); persist(root); });
      window.addEventListener('beforeunload', write);
      return () => { window.removeEventListener('beforeunload', write); write(); };
    },
  };
}

// With no project config, render the setup screen rather than making invalid Firebase requests.
export const backend: Backend | null = isDemo ? demoBackend() : isConfigured ? firebaseBackend() : null;
export function route(path: string) { return path + (isDemo ? '?demo=1' : ''); }
export function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: string })?.code?.toUpperCase() ?? '';
  return code === 'PERMISSION_DENIED' || code === 'DATABASE/PERMISSION-DENIED';
}
export function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (isPermissionDenied(error)) return 'Firebase rejected this database request. Controller access requires the project’s published database rules; player answers also require a valid seat and an open submission window.';
  if (code === 'auth/unauthorized-domain') return 'Add this website’s domain in Firebase Authentication → Settings → Authorized domains.';
  if (code === 'auth/operation-not-allowed') return 'Enable Google sign-in in Firebase Authentication → Sign-in method.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Sign-in was closed. Tap the button to try again.';
  return error instanceof Error ? error.message : String(error);
}
