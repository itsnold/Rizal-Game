import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Copy, Download, ExternalLink, Flag, LoaderCircle, Monitor, Play, Plus, RotateCcw, Search, Settings2, ShieldCheck, Square, Trophy, Upload, Users, X } from 'lucide-react';
import { backend, friendlyError, isDemo, route } from './backend';
import { changeMode, createSession, finalizeRound, launchRound, resetSession, voidRound } from './game-service';
import { useControllerAccess, useGame, useIdentity, useValue, useWakeLock, secondsLeft } from './hooks';
import { LETTERS, parseQuestions, parseRoster, standings, type Answer, type Group, type Question, type Representative, type SessionPublic } from './model';
import { Choices, ErrorNotice, Eyebrow, Frame, Leaderboard, Loading, Notice, RoundRanking, SetupCard, SignIn } from './components';
import { QuestionManager, RosterManager } from './ContentManager';
import ControllerManager from './ControllerManager';
import { PRIMARY_CONTROLLER } from './access';

function saveFile(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export default function Host() {
  const { identity, loading: authLoading } = useIdentity();
  const admin = useControllerAccess(identity);
  const game = useGame();
  const questions = useValue<Record<string, Question>>(admin.value ? 'questions' : null);
  const roster = useValue<Record<string, Representative>>(admin.value ? 'roster' : null);
  const answers = useValue<Record<string, Answer>>(admin.value && game.sessionId && game.round ? `sessions/${game.sessionId}/submissions/${game.round.id}` : null);
  const presence = useValue<Record<string, Record<string, boolean>>>(game.sessionId ? `presence/${game.sessionId}` : null);
  const awake = useWakeLock(!!admin.value);
  const [selected, setSelected] = useState('');
  const [prepared, setPrepared] = useState(false);
  const [practice, setPractice] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  const [manager, setManager] = useState<'questions' | 'roster' | 'controllers' | null>(null);
  const [title, setTitle] = useState('Rizal Live');
  const [rosterText, setRosterText] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<'void' | 'new' | 'end' | 'reset' | null>(null);
  const finalizing = useRef(false);
  const lastFinalizeAttempt = useRef(0);
  const rejectingController = useRef(false);
  const allQuestions = Object.values(questions.value ?? {});
  const question = questions.value?.[selected] ?? null;
  const active = !!game.round && game.round.state === 'open';
  const result = game.round ? game.session?.results?.[game.round.id] : null;
  const playable = game.connection.connected && game.connection.clockReady;

  async function action(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!admin.value || !game.round || !game.session || !playable || game.round.state !== 'open' || game.now <= game.round.acceptsUntil + 250 || finalizing.current || Date.now() - lastFinalizeAttempt.current < 2000) return;
    const q = questions.value?.[game.round.questionId] ?? null;
    finalizing.current = true;
    lastFinalizeAttempt.current = Date.now();
    void finalizeRound(game.sessionId, game.round.id, q, Date.now() + game.connection.offset)
      .catch(e => setError(friendlyError(e)))
      .finally(() => { finalizing.current = false; });
  }, [admin.value, game.round, game.session, game.now, game.sessionId, game.connection.offset, playable, questions.value]);

  useEffect(() => {
    if (roster.value) setRosterText(Object.values(roster.value).map(rep => `${game.session?.groups?.[rep.groupId]?.name ?? rep.groupId}, ${rep.email}`).join('\n'));
    if (game.lobby?.title) setTitle(game.lobby.title);
  }, [roster.value, game.session?.groups, game.lobby?.title]);

  useEffect(() => { setPrepared(false); }, [questions.value]);

  useEffect(() => {
    if (!backend || backend.demo || !identity || admin.loading || admin.value || !game.connection.connected || rejectingController.current) return;
    rejectingController.current = true;
    sessionStorage.setItem('rizal-auth-error', 'This email is not an authorized controller. Sign in with rsegundo@addu.edu.ph or an email added by that account.');
    void backend.logout().finally(() => { rejectingController.current = false; });
  }, [identity?.uid, admin.loading, admin.value, game.connection.connected]);

  if (!backend) return <Frame page="HOST"><main className="narrow"><SetupCard /></main></Frame>;
  if (authLoading) return <Frame page="HOST"><Loading /></Frame>;
  if (!identity) return <Frame page="HOST"><main className="auth-main"><SignIn host /></main></Frame>;
  if (admin.loading) return <Frame page="HOST"><Loading label="Checking host access…" /></Frame>;
  if (!admin.value) return <Frame page="HOST" identity={identity}><main className="narrow"><section className="card access-card"><ShieldCheck size={32} /><h1>Controller access required.</h1><p><strong>{identity.email}</strong> is not authorized. Sign in with <strong>{PRIMARY_CONTROLLER}</strong> or ask that account to add you as a controller.</p><ErrorNotice>{admin.error}</ErrorNotice><button className="button primary" onClick={() => void backend!.logout()}>Switch account</button></section></main></Frame>;

  const answered = Object.keys(answers.value ?? {}).length;
  const groups = Object.values(game.session?.groups ?? {});
  const readyCount = groups.filter(g => Object.values(presence.value?.[g.id] ?? {}).some(Boolean)).length;
  const canSetUp = !active && playable && !busy;
  const used = (id: string) => Object.values(game.session?.rounds ?? {}).filter(r => r.questionId === id && !r.practice && r.state !== 'void');
  async function saveQuestions() {
    const bank = parseQuestions(JSON.parse(questionText));
    await backend!.write('questions', bank);
    setQuestionText(''); setSelected(''); setPrepared(false);
  }
  async function newSession() {
    const { groups: nextGroups, roster: nextRoster } = rosterText.trim() ? parseRoster(rosterText) : { groups: {}, roster: {} };
    await createSession(title.trim() || 'Rizal Live', nextGroups, nextRoster);
    setConfirm(null); setSettings(false); setPrepared(false); setSelected('');
  }
  async function reset() {
    await resetSession(game.sessionId);
    setPrepared(false); setSelected(''); setPractice(false); setSettings(false);
  }
  async function start() {
    if (!question || !prepared) return;
    await launchRound(game.sessionId, question, practice, Date.now() + game.connection.offset);
    setPrepared(false);
  }
  async function copyJoinLink() {
    try { await navigator.clipboard.writeText(location.origin + route('/play')); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError(`Join link: ${location.origin + route('/play')}`); }
  }

  return <Frame page="CONTROL ROOM" connected={game.connection.connected} identity={identity}><main className="host-main">
    <div className="host-heading"><div><Eyebrow>YOU SET THE PACE</Eyebrow><h1>The control room<span>.</span></h1><p>Your slides lead the story. You decide when the game joins in.</p></div><div className="button-row"><a className="button secondary" href={route('/display')} target="_blank" rel="noreferrer"><Monitor size={17} /> Open big screen <ExternalLink size={14} /></a><button className="button ghost" onClick={() => setSettings(!settings)}><Settings2 size={17} /> Setup</button><button className="button secondary" disabled={!game.session || busy || !playable} onClick={() => setConfirm('reset')}><RotateCcw size={16} /> Reset session</button></div></div>
    <ErrorNotice>{error || game.error || questions.error || roster.error || answers.error}</ErrorNotice>
    {!game.connection.connected && <Notice>Reconnecting to Firebase. Controls will unlock once the connection returns.</Notice>}
    {(!game.session || !allQuestions.length) && <Notice>Start with Setup: import your question bank, add representative emails, and create a session.</Notice>}
    <div className="host-manager-tabs"><button className={`button ${manager === 'questions' ? 'primary' : 'secondary'}`} onClick={() => setManager(manager === 'questions' ? null : 'questions')}><Plus size={16} /> Manage questions <span className="tab-count">{allQuestions.length}</span></button><button className={`button ${manager === 'roster' ? 'primary' : 'secondary'}`} onClick={() => setManager(manager === 'roster' ? null : 'roster')}><Users size={16} /> Authorized emails & groups <span className="tab-count">{Object.keys(roster.value ?? {}).length}</span></button>{admin.owner && <button className={`button ${manager === 'controllers' ? 'primary' : 'secondary'}`} onClick={() => setManager(manager === 'controllers' ? null : 'controllers')}><ShieldCheck size={16} /> Controllers</button>}{manager && <button className="button ghost" onClick={() => setManager(null)}><X size={16} /> Close manager</button>}</div>
    {manager === 'questions' && <QuestionManager questions={questions.value ?? {}} connected={playable} />}
    {manager === 'roster' && <RosterManager roster={roster.value ?? {}} session={game.session} connected={playable} />}
    {manager === 'controllers' && admin.owner && <ControllerManager connected={playable} />}

    {settings && <section className="card settings-panel"><div className="section-heading"><div><Eyebrow>BEFORE THE PRESENTATION</Eyebrow><h2>Make it yours.</h2></div><button className="icon-button" aria-label="Close setup" onClick={() => setSettings(false)}><X size={20} /></button></div>
      <div className="settings-grid"><div><h3><Users size={18} /> Groups & representatives</h3><label htmlFor="game-title">Presentation title</label><input id="game-title" value={title} maxLength={100} onChange={e => setTitle(e.target.value)} disabled={active} /><label htmlFor="roster">One group and email per line</label><textarea id="roster" rows={7} value={rosterText} onChange={e => setRosterText(e.target.value)} placeholder={'Group 1, representative1@addu.edu.ph\nGroup 2, representative2@addu.edu.ph'} disabled={active} /><small>One representative per group. Creating a session starts a fresh score board and applies this roster. Earlier sessions stay saved.</small><button className="button primary" disabled={!canSetUp} onClick={() => setConfirm('new')}><Plus size={17} /> Create fresh session</button></div>
      <div><h3><Upload size={18} /> Prewritten questions</h3><p>Import a JSON question bank. A ready-to-edit example is included at <code>content/questions.example.json</code>.</p><label className={`button secondary file-button ${active ? 'disabled' : ''}`}><Upload size={16} /> Choose JSON file<input type="file" accept=".json,application/json" disabled={active} onChange={e => { const file = e.target.files?.[0]; if (file) { if (file.size > 500_000) { setError('Keep the question bank under 500 KB; put image files in assets.'); return; } void file.text().then(setQuestionText).catch(err => setError(friendlyError(err))); } }} /></label><textarea aria-label="Question bank JSON" rows={7} value={questionText} onChange={e => setQuestionText(e.target.value)} placeholder="Or paste the JSON array here…" disabled={active} spellCheck={false} /><small>Replacing the bank preserves existing results. Keep question IDs stable if you want to replay them.</small><div className="button-row"><button className="button primary" disabled={!questionText || !canSetUp} onClick={() => void action(saveQuestions)}>Save question bank <Check size={16} /></button>{allQuestions.length > 0 && <button className="button ghost" onClick={() => saveFile('questions.json', allQuestions)}><Download size={16} /> Export</button>}</div></div></div>
    </section>}

    <div className="host-stats"><div><span>THE SESSION</span><strong>{game.session?.title ?? 'Not started'}</strong></div><div><span>REPRESENTATIVES</span><strong>{readyCount}<small> / {groups.length} online</small></strong></div><div><span>QUESTIONS PLAYED</span><strong>{Object.values(game.session?.rounds ?? {}).filter(r => r.state === 'finalized' && !r.practice).length}<small> / {allQuestions.length}</small></strong></div><div><span>HOST DEVICE</span><strong className="small-stat">{awake ? 'Screen stays awake' : 'Keep this tab open'}</strong></div></div>

    <div className="host-grid"><section className="card question-bank"><div className="section-heading"><h2>Question bank</h2><span className="count-badge">{allQuestions.length}</span></div><div className="search-box"><Search size={17} /><input aria-label="Search questions" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a moment in your story…" /></div><div className="question-list">{allQuestions.filter(q => `${q.prompt} ${q.section}`.toLowerCase().includes(search.toLowerCase())).map((q, i) => <button key={q.id} className={`question-item ${selected === q.id ? 'active' : ''}`} disabled={active || busy} onClick={() => { setSelected(q.id); setPrepared(false); }}><span className="question-number">{String(i + 1).padStart(2, '0')}</span><span><small>{q.section}</small><strong>{q.prompt}</strong><em>{used(q.id).length ? 'PLAYED' : 'UNUSED'}</em></span><ArrowRight size={16} /></button>)}{!allQuestions.length && <div className="empty-bank"><Upload size={28} /><p>Your questions go here.</p><button className="button secondary" onClick={() => setSettings(true)}>Import question bank</button></div>}</div></section>

      <section className="card cue-panel"><div className="section-heading"><h2>{active ? 'Live round' : result && game.phase === 'results' ? 'Round complete' : 'Your next cue'}</h2><span className={`status-pill ${active ? 'live' : ''}`}><span className="tiny-dot" />{active ? game.phase.toUpperCase() : prepared ? 'PREPARED' : 'STANDBY'}</span></div>
        {active && game.round ? <><div className="live-round-clock"><span>{game.phase === 'intro' ? 'STARTING IN' : game.phase === 'collecting' ? 'FINALIZING' : 'SECONDS LEFT'}</span><strong>{game.phase === 'intro' ? Math.ceil((game.round.opensAt - game.now) / 1000) : game.phase === 'collecting' ? <LoaderCircle className="spin" size={40} /> : secondsLeft(game.round, game.now)}</strong></div><h3 className="cue-question">{game.round.prompt}</h3><div className="response-count"><Users size={18} />{answered} of {groups.length} groups answered</div><p className="muted">{game.phase === 'collecting' ? 'Waiting for in-time submissions, then publishing results automatically.' : 'Players’ choices are open for the full 20-second window.'}</p><button className="button danger" disabled={busy || !playable} onClick={() => setConfirm('void')}><Square size={15} /> Void this round</button></>
          : result && game.phase === 'results' && game.session ? <><div className="answer-reveal"><CheckCircle2 size={23} /><span>Correct answer <strong>{LETTERS[result.correctIndex]} · {game.round?.choices[result.correctIndex]}</strong></span>{result.practice && <span className="tag">PRACTICE</span>}</div><RoundRanking result={result} session={game.session} /><div className="button-row"><button className="button primary" disabled={busy || !playable} onClick={() => void action(() => changeMode(game.sessionId, 'waiting'))}>Back to presentation <ArrowRight size={16} /></button><button className="button ghost" disabled={busy || !playable} onClick={() => setConfirm('void')}>Void result</button></div><p className="muted small">Select the next question from the bank. Results stay on screen until you change the view.</p></>
          : question ? <><div className="private-label"><ShieldCheck size={14} /> PRIVATE PREVIEW · ONLY YOU SEE THIS</div><span className="question-section">{question.section}</span><h3 className="cue-question">{question.prompt}</h3>{question.image && <img className="question-image" src={question.image} alt="Question illustration" />}<Choices choices={question.choices} correct={question.correctIndex} disabled /><p className="preview-answer">Correct: {LETTERS[question.correctIndex]}{question.explanation && ` · ${question.explanation}`}</p><label className="toggle-label"><input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)} /> Practice round <small>No points awarded</small></label>{used(question.id).length > 0 && <Notice>This question has already been played. Launching it again creates a new scoring round.</Notice>}<div className="button-row"><button className={`button ${prepared ? 'secondary' : 'primary'}`} disabled={!game.session || busy || !playable} onClick={() => setPrepared(true)}>{prepared ? <Check size={17} /> : <Flag size={17} />}{prepared ? 'Prepared' : 'Prepare question'}</button><button className="button primary play-button" disabled={!prepared || !game.session || busy || !playable} onClick={() => void action(start)}>{busy ? <LoaderCircle size={17} className="spin" /> : <Play size={17} fill="currentColor" />} Play</button></div><small className="cue-hint">Prepare privately, switch the laptop to the big screen, then press Play here.</small></>
          : <div className="cue-empty"><div className="cue-empty-icon"><Play size={30} /></div><h3>A question, on your cue.</h3><p>Select any question from the bank.<br />Nothing goes live until you press Play.</p></div>}
      </section>
    </div>

    <div className="host-bottom-grid"><section className="card"><div className="section-heading"><h2>The room</h2><button className="button ghost small" onClick={() => void copyJoinLink()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy join link'}</button></div><div className="room-list">{groups.map(group => <div key={group.id} className="room-row"><span className="group-avatar" style={{ background: group.color }}>{group.name[0]}</span><span><strong>{group.name}</strong><small>{Object.values(roster.value ?? {}).find(r => r.groupId === group.id)?.email}</small></span><span className={`online-dot ${Object.values(presence.value?.[group.id] ?? {}).some(Boolean) ? 'on' : ''}`} /><button className="icon-button" title={`Release ${group.name} device`} aria-label={`Release ${group.name} device`} disabled={busy || !playable} onClick={() => void action(() => backend!.write(`sessions/${game.sessionId}/leases/${group.id}`, null))}><RotateCcw size={15} /></button></div>)}</div><small>Release a device if a representative needs to switch phones. Their accepted answers and scores stay saved.</small></section>
      <section className="card"><div className="section-heading"><h2>Overall standings</h2><Trophy size={20} /></div><Leaderboard session={game.session} compact /><div className="button-row"><button className="button secondary" disabled={!game.session || active || busy || !playable} onClick={() => void action(() => changeMode(game.sessionId, 'leaderboard'))}><Trophy size={16} /> Show standings</button><button className="button ghost" disabled={!game.session || active || busy || !playable} onClick={() => setConfirm('end')}>Final podium <ArrowRight size={16} /></button><button className="button ghost" disabled={!game.session} onClick={() => saveFile('rizal-game-results.json', { session: game.session, leaderboard: standings(game.session), exportedAt: new Date().toISOString() })}><Download size={16} /> Export</button></div>{(game.phase === 'leaderboard' || game.phase === 'ended' || game.phase === 'void') && <button className="button primary full" disabled={busy || !playable} onClick={() => void action(() => changeMode(game.sessionId, 'waiting'))}>Back to waiting <ArrowRight size={16} /></button>}</section></div>
    {confirm && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="confirmation-title" className="modal card"><h2 id="confirmation-title">{confirm === 'reset' ? 'Reset this session?' : confirm === 'new' ? 'Start a fresh session?' : confirm === 'void' ? 'Void this round?' : 'Ready for the final podium?'}</h2><p>{confirm === 'reset' ? 'Start at zero points with all questions unused. Your questions, authorized emails, group names, and controllers stay saved. Any running round ends, and all connected screens return to waiting. The previous session remains archived.' : confirm === 'new' ? 'The roster above becomes the active whitelist. The new session starts at zero; previous sessions remain saved in Firebase.' : confirm === 'void' ? 'This round’s points will be removed from the standings. You can replay the question as a new round.' : 'Show the final standings on phones and the projector. You can return to waiting afterward.'}</p><div className="button-row"><button className="button primary" disabled={busy} onClick={() => void action(async () => { if (confirm === 'reset') await reset(); else if (confirm === 'new') await newSession(); else if (confirm === 'void' && game.round) await voidRound(game.sessionId, game.round.id); else if (confirm === 'end') await changeMode(game.sessionId, 'ended'); setConfirm(null); })}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Confirm</button><button className="button secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div><ErrorNotice>{error}</ErrorNotice></section></div>}
  </main></Frame>;
}
