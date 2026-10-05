import { useEffect, useRef, useState } from 'react';
import { backend, friendlyError, type Connection } from './backend';
import { phaseOf, type Identity, type Lobby, type Round, type SessionPublic } from './model';
import { PRIMARY_CONTROLLER } from './access';
import { emailKey } from './model';

export function useValue<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; value: T | null; error: string; loading: boolean }>({ path, value: null, error: '', loading: !!path });
  useEffect(() => {
    setState({ path, value: null, error: '', loading: !!path });
    if (!path || !backend) return;
    return backend.watch<T>(path, value => setState({ path, value, error: '', loading: false }), error => setState({ path, value: null, error: friendlyError(error), loading: false }));
  }, [path]);
  if (state.path !== path) return { value: null, error: '', loading: !!path };
  return state;
}

export function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => backend?.watchAuth(user => { setIdentity(user); setLoading(false); }), []);
  return { identity, loading };
}

export function useControllerAccess(identity: Identity | null) {
  const owner = identity?.email.toLowerCase() === PRIMARY_CONTROLLER || (!!backend?.demo && identity?.uid === 'demo-host');
  const controller = useValue<boolean>(identity ? `controllers/${emailKey(identity.email)}` : null);
  return { value: !!identity && (owner || controller.value === true), owner, loading: !owner && controller.loading, error: owner ? '' : controller.error };
}

export function useConnection() {
  const [connection, setConnection] = useState<Connection>({ connected: false, clockReady: false, offset: 0 });
  useEffect(() => backend?.watchConnection(setConnection), []);
  return connection;
}

export function useGame() {
  const connection = useConnection();
  const lobby = useValue<Lobby>('lobby');
  const session = useValue<SessionPublic>(lobby.value?.sessionId ? `sessions/${lobby.value.sessionId}/public` : null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setTick(t => t + 1), 50); return () => clearInterval(timer); }, []);
  const round = session.value?.rounds?.[session.value.currentRoundId] ?? null;
  const anchor = useRef<{ id: string; perf: number; elapsed: number } | null>(null);
  const anchorId = `${round?.id ?? ''}:${connection.clockReady}`;
  if (round && anchor.current?.id !== anchorId) {
    anchor.current = { id: anchorId, perf: performance.now(), elapsed: Date.now() + connection.offset - round.opensAt };
  }
  const elapsed = () => anchor.current ? anchor.current.elapsed + performance.now() - anchor.current.perf : 0;
  // Once a round is received, wall-clock changes and later offset samples cannot move its timer.
  const now = round ? round.opensAt + elapsed() : Date.now() + connection.offset;
  void tick;
  return { connection, lobby: lobby.value, session: session.value, sessionId: lobby.value?.sessionId ?? '', round, phase: phaseOf(session.value, now), now, elapsed, error: lobby.error || session.error, loading: lobby.loading || session.loading };
}

export function useWakeLock(enabled: boolean) {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let handle: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || stopped) return;
      try {
        handle = await navigator.wakeLock.request('screen');
        if (stopped) { await handle.release(); return; }
        setAwake(true);
        handle.addEventListener('release', () => setAwake(false));
      } catch { setAwake(false); }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => { stopped = true; document.removeEventListener('visibilitychange', acquire); void handle?.release(); };
  }, [enabled]);
  return awake;
}

export function secondsLeft(round: Round | null, now: number) { return round ? Math.max(0, Math.ceil((round.closesAt - now) / 1000)) : 20; }
