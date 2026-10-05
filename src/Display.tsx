import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowUpRight, CheckCircle2, Clock3, Expand, LoaderCircle, Trophy, Volume2, VolumeX, WifiOff, Zap } from 'lucide-react';
import { backend, isDemo, route } from './backend';
import { useStageAudio } from './audio';
import { useGame, useValue, useWakeLock, secondsLeft } from './hooks';
import { ANSWER_MS, LETTERS, standings } from './model';
import { Choices, Eyebrow, Leaderboard, RoundIntro, RoundRanking, SetupCard, WaitingArt } from './components';

export default function Display() {
  const game = useGame();
  const audio = useStageAudio(game.phase, game.round, game.now);
  const presence = useValue<Record<string, Record<string, boolean>>>(game.sessionId ? `presence/${game.sessionId}` : null);
  useWakeLock(true);
  const joinLink = location.origin + route('/play');
  const result = game.round ? game.session?.results?.[game.round.id] : null;
  useEffect(() => { document.documentElement.classList.add('display-document'); return () => document.documentElement.classList.remove('display-document'); }, []);
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* Fullscreen is optional on unsupported tablet browsers. */ } }
  if (!backend) return <main className="narrow"><SetupCard /></main>;

  const groups = Object.values(game.session?.groups ?? {});
  const fastest = result ? Object.values(result.rows).filter(r => r.correct).sort((a, b) => a.elapsedMs - b.elapsedMs)[0] : null;
  return <div className={`stage stage-${game.phase}`}>
    <header className="stage-header stage-minimal-header"><span /><div className="stage-tools">{!game.connection.connected && <span className="stage-connection"><WifiOff size={15} /> Reconnecting</span>}<button className={`stage-tool ${audio.enabled ? '' : 'sound-disabled'}`} onClick={() => audio.enabled ? audio.mute() : void audio.enable()} aria-label={audio.enabled ? 'Mute sound' : 'Enable sound'} title={audio.enabled ? 'Mute sound' : 'Enable sound'}>{audio.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><button className="stage-tool" onClick={() => void fullscreen()} aria-label="Toggle fullscreen" title="Fullscreen"><Expand size={18} /></button></div></header>
    {(game.error || audio.error) && <div className="stage-error" role="alert">{game.error || audio.error}</div>}
    {isDemo && <div className="stage-demo">LOCAL REHEARSAL · same-browser tabs only</div>}

    {game.phase === 'waiting' && <main className="stage-lobby stage-lobby-minimal"><div className="stage-lobby-copy"><WaitingArt /><h1>Ready?</h1><div className="stage-group-chips">{groups.map(group => <span key={group.id}><i style={{ background: Object.values(presence.value?.[group.id] ?? {}).some(Boolean) ? group.color : '#4b5148' }} />{group.name}</span>)}</div></div><div className="qr-card"><div className="qr-code"><QRCodeSVG value={joinLink} size={210} bgColor="#f8f8ee" fgColor="#111511" level="M" marginSize={2} /></div><div className="join-url">{joinLink.replace(/^https?:\/\//, '')}<ArrowUpRight size={15} /></div></div></main>}

    {game.phase === 'intro' && game.round && <main className="stage-intro stage-intro-shapes"><RoundIntro count={Math.ceil((game.round.opensAt - game.now) / 1000)} practice={game.round.practice} large /></main>}

    {game.phase === 'answering' && game.round && <main className="stage-question"><div className="stage-question-top">{game.round.practice ? <Eyebrow>PRACTICE</Eyebrow> : <span />}<span className={`stage-timer ${secondsLeft(game.round, game.now) <= 5 ? 'urgent' : ''}`}><Clock3 size={25} />{secondsLeft(game.round, game.now)}<small>SECONDS</small></span></div><div className="stage-question-body"><div><h1>{game.round.prompt}</h1><Choices choices={game.round.choices} disabled /></div>{game.round.image && <img src={game.round.image} alt="Question illustration" className="stage-question-image" />}</div><div className="stage-timer-track"><span style={{ width: `${Math.max(0, (game.round.closesAt - game.now) / ANSWER_MS * 100)}%` }} /></div></main>}

    {game.phase === 'collecting' && <main className="stage-collecting"><LoaderCircle size={55} className="spin" /><h1>Time’s up<span>.</span></h1></main>}

    {game.phase === 'results' && result && game.session && game.round && <main className="stage-results"><div className="stage-results-heading"><div>{result.practice && <Eyebrow>PRACTICE</Eyebrow>}<h1>{LETTERS[result.correctIndex]}<span> · </span>{game.round.choices[result.correctIndex]}</h1>{result.explanation && <p>{result.explanation}</p>}</div><CheckCircle2 size={60} strokeWidth={1.4} /></div><div className="stage-results-grid"><section><h2>This round</h2><RoundRanking result={result} session={game.session} /></section><section className="fastest-card"><Zap size={34} /><span>FASTEST CORRECT</span><h2>{fastest ? game.session.groups[fastest.groupId]?.name : 'No correct answers.'}</h2>{fastest && <><strong>{(fastest.elapsedMs / 1000).toFixed(2)}<small>SECONDS</small></strong><p>+{fastest.points.toLocaleString()} points{Object.values(result.rows).filter(r => r.rank === 1).length > 1 ? ' · tied first' : ''}</p></>}</section></div></main>}

    {(game.phase === 'leaderboard' || game.phase === 'ended') && <main className="stage-standings"><div className="stage-standings-heading"><h1>{game.phase === 'ended' ? 'Final scores.' : 'Standings.'}</h1>{game.phase === 'ended' && <Trophy size={50} />}</div><Leaderboard session={game.session} final={game.phase === 'ended'} /></main>}
    {game.phase === 'void' && <main className="stage-collecting"><h1>Round cancelled<span>.</span></h1><p>No points counted.</p></main>}
  </div>;
}
