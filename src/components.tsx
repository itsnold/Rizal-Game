import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronRight, CircleHelp, LoaderCircle, LogOut, Monitor, Radio, Smartphone, Trophy, Wifi, WifiOff, Zap } from 'lucide-react';
import { backend, friendlyError, isDemo, route } from './backend';
import { LETTERS, SYMBOLS, standings, type Identity, type RoundResult, type SessionPublic } from './model';

export function Brand({ dark = false }: { dark?: boolean }) {
  return <a className={`brand ${dark ? 'brand-dark' : ''}`} href={route('/')} aria-label="Rizal Live home"><span className="brand-mark">r.</span><span>rizal<span className="brand-light">live</span><i /></span></a>;
}
export function Frame({ children, page, connected, identity, minimal = false }: { children: ReactNode; page?: string; connected?: boolean; identity?: Identity | null; minimal?: boolean }) {
  return <div className="app-frame">
    {isDemo && <div className="demo-banner"><span>LOCAL REHEARSAL</span> Same-browser tabs only · sample accounts · no Firebase connection <a href={location.pathname}>Exit rehearsal <ArrowRight size={12} /></a></div>}
    <header className={`site-header ${minimal ? 'player-header' : ''}`}>{minimal ? <span /> : <Brand />}<div className="header-right">
      {page && !minimal && <span className="page-label">{page}</span>}
      {connected !== undefined && <span className={`connection ${connected ? '' : 'offline'}`}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />}{connected ? 'Connected' : 'Reconnecting'}</span>}
      {identity && <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={() => void backend?.logout()}><LogOut size={17} /></button>}
    </div></header>
    {children}
    {!minimal && <footer className="site-footer"><span>Made for the moments between slides.</span><span>RIZAL LIVE <span className="footer-dot">●</span> CLASSROOM EDITION</span></footer>}
  </div>;
}
export function ErrorNotice({ children }: { children: ReactNode }) { return children ? <div className="notice error" role="alert"><CircleHelp size={18} /><div>{children}</div></div> : null; }
export function Notice({ children }: { children: ReactNode }) { return <div className="notice"><Radio size={18} /><div>{children}</div></div>; }
export function Loading({ label = 'Getting things ready…' }: { label?: string }) { return <div className="loading"><LoaderCircle className="spin" size={26} /><p>{label}</p></div>; }
export function Eyebrow({ children }: { children: ReactNode }) { return <div className="eyebrow"><span className="tiny-dot" />{children}</div>; }

export function SetupCard() {
  return <section className="setup-card card"><div className="section-heading"><span className="step-tag">SETUP</span><h2>Give your game a home.</h2></div>
    <p>The app is built. Connect your free Firebase project to bring the tablet, projector, and phones together.</p>
    <ol className="setup-steps"><li>Create a project on the <strong>Spark</strong> plan.</li><li>Enable <strong>Google sign-in</strong> and create a <strong>Realtime Database</strong>.</li><li>Copy the Web app config and database URL into <code>.env.local</code>.</li><li>Deploy the included rules, then sign in as <strong>rsegundo@addu.edu.ph</strong>. Full steps are in <strong>FIREBASE_SETUP.md</strong>.</li></ol>
    <div className="button-row"><a className="button primary" href="/host?demo=1">Try local rehearsal <ArrowRight size={17} /></a><a className="button ghost" href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">Open Firebase <ChevronRight size={17} /></a></div>
    <small>No payment method needed. The full setup guide is in the project folder.</small>
  </section>;
}

export function SignIn({ host = false }: { host?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(sessionStorage.getItem('rizal-auth-error') ?? '');
  async function login(group?: number) {
    setBusy(true); setError(''); sessionStorage.removeItem('rizal-auth-error');
    try { await backend?.login(group); } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  }
  return <section className="auth-card card">
    <div className="auth-icon">{host ? <Monitor size={26} /> : <Smartphone size={26} />}</div>
    {host && <Eyebrow>THE CONTROL ROOM</Eyebrow>}
    <h1>{host ? 'You set the pace.' : 'Join your group.'}</h1>
    {host && <p>Sign in to cue questions, follow responses, and reveal the standings.</p>}
    {isDemo ? host ? <button className="button primary full" disabled={busy} onClick={() => void login()}>Enter rehearsal host <ArrowRight size={18} /></button>
      : <div className="demo-group-picker">{['La Liga', 'Ilustrados', 'Propagandistas', 'Los Indios'].map((name, i) => <button key={name} className="button secondary" disabled={busy} onClick={() => void login(i + 1)}>{name}<ArrowRight size={16} /></button>)}</div>
      : <button className="button primary full" disabled={busy} onClick={() => void login()}>{busy ? <LoaderCircle className="spin" size={18} /> : <span className="google-g">G</span>} Continue with Google <ArrowRight size={18} /></button>}
    <ErrorNotice>{error}</ErrorNotice>
    {host && <div className="auth-note"><CheckCircle2 size={15} />Only authorized game controllers can enter.</div>}
  </section>;
}

export function Choices({ choices, selected = -1, correct = -1, disabled = false, onSelect }: { choices: string[]; selected?: number; correct?: number; disabled?: boolean; onSelect?: (index: number) => void }) {
  return <div className="choices">{choices.map((choice, index) => <button key={index} type="button" className={`choice choice-${index} ${selected === index ? 'selected' : ''} ${correct === index ? 'is-correct' : ''} ${correct >= 0 && correct !== index ? 'dimmed' : ''}`} disabled={disabled || !onSelect} onClick={() => onSelect?.(index)}>
    <span className="choice-symbol">{SYMBOLS[index]}</span><span className="choice-text"><small>{LETTERS[index]}</small>{choice}</span>{correct === index ? <CheckCircle2 size={25} /> : selected === index ? <Check size={25} /> : null}
  </button>)}</div>;
}

export function Leaderboard({ session, compact = false, highlight = '', final = false }: { session: SessionPublic | null; compact?: boolean; highlight?: string; final?: boolean }) {
  const rows = standings(session);
  let rank = 0;
  return <div className={`leaderboard ${compact ? 'compact' : ''}`}>{rows.length === 0 ? <p className="muted">Group standings will appear here.</p> : rows.map((group, index) => {
    if (index === 0 || group.points !== rows[index - 1].points || group.correct !== rows[index - 1].correct) rank = index + 1;
    return <div key={group.id} className={`leaderboard-row ${group.id === highlight ? 'highlight' : ''} ${final && rank === 1 ? 'winner' : ''}`}>
      <span className="rank">{rank === 1 && final ? <Trophy size={26} /> : String(rank).padStart(2, '0')}</span><span className="group-avatar" style={{ background: group.color }}>{group.name.slice(0, 1)}</span><span className="group-name">{group.name}{group.id === highlight && <small>YOUR GROUP</small>}</span><strong>{group.points.toLocaleString()}<small>PTS</small></strong>
    </div>;
  })}</div>;
}

export function RoundRanking({ result, session, highlight = '' }: { result: RoundResult; session: SessionPublic; highlight?: string }) {
  const rows = Object.values(result.rows).sort((a, b) => Number(b.correct) - Number(a.correct) || (a.elapsedMs < 0 ? Infinity : a.elapsedMs) - (b.elapsedMs < 0 ? Infinity : b.elapsedMs));
  return <div className="round-ranking">{rows.map(row => <div key={row.groupId} className={`result-row ${highlight === row.groupId ? 'highlight' : ''}`}>
    <span className={`result-mark ${row.correct ? 'correct' : ''}`}>{row.correct ? <Check size={16} /> : '–'}</span><span className="result-group">{session.groups[row.groupId]?.name ?? row.groupId}<small>{row.correct ? `#${row.rank} correct` : row.choice < 0 ? 'No answer' : 'Incorrect'}{row.elapsedMs >= 0 ? ` · ${(row.elapsedMs / 1000).toFixed(2)}s` : ''}</small></span><strong>+{row.points}</strong>
  </div>)}</div>;
}

export function WaitingArt() {
  return <div className="waiting-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-center"><Zap size={52} strokeWidth={1.5} /></div><span className="orbit-shape shape-one">▲</span><span className="orbit-shape shape-two">◆</span><span className="orbit-shape shape-three">●</span></div>;
}

export function RoundIntro({ count, practice = false, large = false }: { count: number; practice?: boolean; large?: boolean }) {
  const active = Math.max(0, Math.min(3, 4 - count));
  return <div className={`round-intro ${large ? 'round-intro-large' : ''}`}>
    {practice && <span className="intro-practice">PRACTICE</span>}
    <div className="intro-shapes" aria-hidden="true">{SYMBOLS.map((symbol, index) => <div key={symbol} className={`intro-tile intro-tile-${index} ${active === index ? 'intro-tile-active' : ''}`}><span>{symbol}</span></div>)}</div>
    <div className={`intro-count ${count > 3 ? 'intro-ready' : ''}`} key={count} aria-live="polite">{count > 3 ? <Zap size={large ? 80 : 52} fill="currentColor" /> : count}</div>
  </div>;
}
