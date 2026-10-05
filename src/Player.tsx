import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Clock3, LoaderCircle, LockKeyhole, RotateCcw, Trophy, Zap } from 'lucide-react';
import { backend, friendlyError, route } from './backend';
import { useGame, useIdentity, useValue, useWakeLock, secondsLeft } from './hooks';
import { ANSWER_MS, LETTERS, standings, type Answer, type Lease, type Representative } from './model';
import { Choices, ErrorNotice, Eyebrow, Frame, Leaderboard, Loading, Notice, RoundIntro, RoundRanking, SetupCard, SignIn, WaitingArt } from './components';

function deviceId() {
  let value = sessionStorage.getItem('rizal-device');
  if (!value) { value = crypto.randomUUID(); sessionStorage.setItem('rizal-device', value); }
  return value;
}
interface Tap { roundId: string; choice: number; elapsedMs: number }

export default function Player() {
  const { identity, loading: authLoading } = useIdentity();
  const game = useGame();
  const key = identity?.email.trim().toLowerCase().replaceAll('.', ',');
  const representative = useValue<Representative>(key ? `roster/${key}` : null);
  const groupId = representative.value?.groupId ?? '';
  const group = game.session?.groups?.[groupId];
  const device = useRef(deviceId()).current;
  const leasePath = groupId && game.sessionId ? `sessions/${game.sessionId}/leases/${groupId}` : null;
  const lease = useValue<Lease>(leasePath);
  const answerPath = groupId && game.sessionId && game.round ? `sessions/${game.sessionId}/submissions/${game.round.id}/${groupId}` : null;
  const accepted = useValue<Answer>(answerPath);
  const [leaseError, setLeaseError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [retryClaim, setRetryClaim] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [tap, setTap] = useState<Tap | null>(null);
  const tapRef = useRef<Tap | null>(null);
  const rejecting = useRef(false);
  const ownsDevice = !!identity && lease.value?.uid === identity.uid && lease.value?.deviceId === device && lease.value.expiresAt > game.now;
  useWakeLock(!!group);

  useEffect(() => {
    if (!backend || backend.demo || !identity || representative.loading || game.loading || game.permissionDenied || representative.permissionDenied || !game.connection.connected || rejecting.current) return;
    if (representative.value) return;
    rejecting.current = true;
    sessionStorage.setItem('rizal-auth-error', 'This email is not authorized for the game. Ask the presenter to authorize your exact school email.');
    void backend.logout().finally(() => { rejecting.current = false; });
  }, [identity?.uid, representative.loading, representative.value, representative.permissionDenied, group?.id, game.loading, game.permissionDenied, game.connection.connected]);

  useEffect(() => {
    const roundId = game.round?.id;
    const stored = roundId ? sessionStorage.getItem(`rizal-tap:${game.sessionId}:${roundId}`) : null;
    let next: Tap | null = null;
    try { next = stored ? JSON.parse(stored) : null; } catch { /* An interrupted storage write should not break the screen. */ }
    tapRef.current = next; setTap(next); setError(''); setPending(false);
  }, [game.round?.id, game.sessionId]);

  useEffect(() => {
    if (!backend || !leasePath || !identity || !group || !game.connection.connected || !game.connection.clockReady) return;
    let disposed = false;
    setClaiming(true); setLeaseError('');
    const claim = async () => {
      try {
        const now = Date.now() + game.connection.offset;
        const committed = await backend!.transact<Lease>(leasePath, existing => {
          if (existing && existing.deviceId !== device && existing.expiresAt > now) return undefined;
          return { uid: identity.uid, deviceId: device, expiresAt: now + 60_000 };
        });
        if (!disposed && !committed) setLeaseError('Another phone or tab is representing your group. Close it and wait up to 60 seconds, or ask the presenter to release the device.');
      } catch (e) { if (!disposed) setLeaseError(friendlyError(e)); }
      finally { if (!disposed) setClaiming(false); }
    };
    void claim();
    return () => { disposed = true; };
  }, [leasePath, identity?.uid, group?.id, game.connection.connected, game.connection.clockReady, retryClaim, device]);

  useEffect(() => {
    if (!backend || !ownsDevice || !leasePath || !identity || !game.connection.connected) return;
    const timer = setInterval(() => {
      const now = Date.now() + game.connection.offset;
      void backend!.transact<Lease>(leasePath, existing => {
        if (!existing || existing.deviceId !== device || existing.uid !== identity.uid) return undefined;
        return { ...existing, expiresAt: now + 60_000 };
      }).catch(e => setLeaseError(friendlyError(e)));
    }, 20_000);
    return () => clearInterval(timer);
  }, [ownsDevice, leasePath, identity?.uid, device, game.connection.connected, game.connection.offset]);

  useEffect(() => {
    if (!backend || !ownsDevice || !group || !game.connection.connected) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    void backend.presence(`presence/${game.sessionId}/${group.id}/${device}`).then(stop => {
      if (disposed) stop(); else cleanup = stop;
    }).catch(e => { if (!disposed) setLeaseError(friendlyError(e)); });
    return () => { disposed = true; cleanup?.(); };
  }, [ownsDevice, group?.id, game.sessionId, device, game.connection.connected]);

  async function send(captured: Tap) {
    if (!backend || !identity || !answerPath || !game.round || captured.roundId !== game.round.id) return;
    setPending(true); setError('');
    try {
      if (backend.demo) {
        const existing = await backend.read<Answer>(answerPath);
        if (existing) return;
        if (Date.now() > game.round.acceptsUntil) throw new Error('The submission window has closed.');
      }
      await backend.write(answerPath, { uid: identity.uid, deviceId: device, choice: captured.choice, elapsedMs: captured.elapsedMs, receivedAt: backend.timestamp() });
    } catch (e) {
      // A lost acknowledgement can cause a harmless duplicate. Check the saved answer first.
      const saved = await backend.read<Answer>(answerPath).catch(() => null);
      if (!saved) setError(game.now > game.round.acceptsUntil ? 'Your answer did not reach Firebase before the submission deadline.' : friendlyError(e));
    } finally { setPending(false); }
  }

  function select(choice: number) {
    if (!game.round || tapRef.current?.roundId === game.round.id || accepted.value || pending || !ownsDevice || game.phase !== 'answering' || !game.connection.connected) return;
    const elapsedMs = Math.floor(game.elapsed());
    if (elapsedMs < 0 || elapsedMs >= ANSWER_MS) return;
    const captured = { roundId: game.round.id, choice, elapsedMs };
    tapRef.current = captured; setTap(captured);
    sessionStorage.setItem(`rizal-tap:${game.sessionId}:${game.round.id}`, JSON.stringify(captured));
    void send(captured);
  }

  if (!backend) return <Frame minimal><main className="narrow"><SetupCard /></main></Frame>;
  if (authLoading) return <Frame minimal><Loading /></Frame>;
  if (!identity) return <Frame minimal><main className="auth-main"><SignIn /></main></Frame>;
  if (representative.loading || game.loading) return <Frame minimal identity={identity}><Loading label="Finding your group…" /></Frame>;
  if (!representative.value || !group) return <Frame minimal identity={identity} connected={game.connection.connected}><main className="narrow"><section className="card access-card"><LockKeyhole size={32} /><h1>Not on the roster yet.</h1><p><strong>{identity.email}</strong></p><p>Ask the presenter to add this email, or sign out to switch accounts.</p><ErrorNotice>{representative.error || game.error}</ErrorNotice><a className="button secondary" href={route('/play')}>Check again <RotateCcw size={16} /></a></section></main></Frame>;

  const result = game.round ? game.session?.results?.[game.round.id] : null;
  const myResult = result?.rows[group.id];
  const total = standings(game.session).find(g => g.id === group.id)?.points ?? 0;
  const locked = tap?.roundId === game.round?.id || !!accepted.value;
  const chosen = accepted.value?.choice ?? (tap && tap.roundId === game.round?.id ? tap.choice : -1);
  const ready = ownsDevice && game.connection.connected && game.connection.clockReady;

  return <Frame minimal connected={game.connection.connected} identity={identity}><main className="player-main">
    <div className="player-group"><span className="group-avatar" style={{ background: group.color }}>{group.name[0]}</span><span><strong>{group.name}</strong></span><span className="player-points"><strong>{total.toLocaleString()}</strong><small>PTS</small></span></div>
    <ErrorNotice>{error || game.error || accepted.error}</ErrorNotice>
    {!game.connection.connected && <Notice>Reconnecting. The round clock continues; your accepted answer stays saved.</Notice>}
    {!ownsDevice && !claiming && <div className="notice error"><LockKeyhole size={19} /><div>{leaseError || 'This device’s seat was released. Rejoin before answering.'}<button className="button secondary small" onClick={() => setRetryClaim(n => n + 1)}>Rejoin on this phone <RotateCcw size={14} /></button></div></div>}
    {claiming && <div className="player-ready"><LoaderCircle size={14} className="spin" /> Reserving your group’s seat…</div>}

    {game.phase === 'waiting' && <section className="player-waiting"><WaitingArt /><h1>{ready ? 'You’re in.' : 'Joining…'}</h1><div className="player-ready"><span className={`online-dot ${ready ? 'on' : ''}`} />{ready ? 'Ready' : 'Connecting'}</div></section>}

    {game.phase === 'intro' && game.round && <section className="player-intro"><RoundIntro count={Math.ceil((game.round.opensAt - game.now) / 1000)} practice={game.round.practice} /></section>}

    {game.phase === 'answering' && game.round && <section className="player-answering"><div className="answering-header"><Eyebrow>{game.round.practice ? 'PRACTICE · NO POINTS' : 'MAKE YOUR MOVE'}</Eyebrow><span className={`phone-timer ${secondsLeft(game.round, game.now) <= 5 ? 'urgent' : ''}`}><Clock3 size={18} />{secondsLeft(game.round, game.now)}s</span></div><div className="timer-track"><span style={{ width: `${Math.max(0, (game.round.closesAt - game.now) / ANSWER_MS * 100)}%` }} /></div>
      {locked ? <div className="answer-locked"><div className={`lock-circle ${pending ? 'pending' : ''}`}>{pending ? <LoaderCircle className="spin" size={37} /> : accepted.value ? <Check size={37} /> : <LockKeyhole size={34} />}</div><h1>{pending ? 'Sending…' : accepted.value ? 'Locked in.' : 'Answer locked.'}</h1><p>{LETTERS[chosen]} · {game.round.choices[chosen]}</p><span className="response-time">{((accepted.value?.elapsedMs ?? tap?.elapsedMs ?? 0) / 1000).toFixed(2)}s</span>{!pending && !accepted.value && tap && ready && <button className="button secondary" onClick={() => void send(tap)}>Retry <RotateCcw size={16} /></button>}</div>
        : <><h1>Choose.</h1><Choices choices={game.round.choices} disabled={!ready} onSelect={select} /></>}
    </section>}

    {game.phase === 'collecting' && <section className="player-collecting"><div className="lock-circle"><LoaderCircle className="spin" size={35} /></div><h1>Time’s up.</h1>{pending && <Notice>Sending…</Notice>}{tap && !accepted.value && !pending && game.round && game.now <= game.round.acceptsUntil && ready && <button className="button secondary" onClick={() => void send(tap)}>Retry <RotateCcw size={16} /></button>}</section>}

    {game.phase === 'results' && result && game.session && game.round && <section className="player-results"><div className={`result-hero ${myResult?.correct ? 'won' : ''}`}><div className="result-icon">{myResult?.correct ? <CheckCircle2 size={39} /> : <FlagIcon />}</div>{result.practice && <Eyebrow>PRACTICE</Eyebrow>}<h1>{myResult?.correct ? 'Correct!' : myResult?.choice === -1 ? 'No answer.' : 'Not quite.'}</h1><div className="points-earned">+{myResult?.points ?? 0}<small>PTS</small></div>{myResult?.correct && <p>#{myResult.rank} · {(myResult.elapsedMs / 1000).toFixed(2)}s</p>}</div><div className="correct-answer-box"><small>ANSWER</small><strong>{LETTERS[result.correctIndex]} · {game.round.choices[result.correctIndex]}</strong>{result.explanation && <p>{result.explanation}</p>}</div><h2 className="small-heading">This round</h2><RoundRanking result={result} session={game.session} highlight={group.id} /><h2 className="small-heading">Standings</h2><Leaderboard session={game.session} compact highlight={group.id} /></section>}

    {(game.phase === 'leaderboard' || game.phase === 'ended') && <section className="player-standings"><div className="standings-icon"><Trophy size={33} /></div><h1>{game.phase === 'ended' ? 'Final scores.' : 'Standings.'}</h1><Leaderboard session={game.session} highlight={group.id} final={game.phase === 'ended'} /></section>}
    {game.phase === 'void' && <section className="player-collecting"><RotateCcw size={38} /><h1>Round cancelled.</h1><p>No points counted.</p></section>}
  </main></Frame>;
}

function FlagIcon() { return <ArrowRight size={39} />; }
