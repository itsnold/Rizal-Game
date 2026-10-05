import { ArrowRight, BookOpen, Monitor, Play, Smartphone, Tablet, Timer, Zap } from 'lucide-react';
import { Frame, Eyebrow, SetupCard } from './components';
import { backend, isDemo, route } from './backend';

export default function Landing() {
  return <Frame><main className="landing">
    <div className="landing-topline"><span>A LITTLE HISTORY. A LITTLE COMPETITION.</span><span>CLASSROOM EDITION / 01</span></div>
    <section className="hero"><div className="hero-copy"><Eyebrow>LIVE, ON YOUR CUE</Eyebrow><h1>History doesn’t<br />have to <em>sit still.</em></h1><p>A question between slides. Twenty seconds to think.<br className="desktop-break" /> One classroom, paying a little more attention.</p><div className="button-row"><a className="button primary" href={backend ? route('/play') : '/play?demo=1'}>Join the game <ArrowRight size={19} /></a><a className="button ghost" href={backend ? route('/host') : '/host?demo=1'}>I’m presenting <Tablet size={17} /></a></div><div className="hero-footnote"><span className="live-dot" />{backend && !isDemo ? 'Google school sign-in · invite-only representatives' : 'Free Firebase hosting · no app to install'}</div></div>
      <div className="hero-visual"><div className="visual-grid" /><div className="visual-caption">THE PRESENTATION IS PART OF THE GAME.</div><div className="floating-tag"><span className="live-dot" /> A QUESTION COULD APPEAR ANYTIME</div><div className="hero-letter">R<span>.</span></div><div className="visual-line" /><div className="mini-question"><span className="mini-label"><BookOpen size={14} /> A QUICK HISTORY CHECK</span><h3>Were you<br /><em>paying attention?</em></h3><div className="mini-bottom"><span><Timer size={14} /> 20 seconds</span><span className="mini-go"><Play size={14} fill="currentColor" /></span></div></div><div className="visual-bottom"><span>WATCH. THINK. ANSWER.</span><Zap size={20} /></div></div>
    </section>
    <section className="role-cards"><a href={backend ? route('/play') : '/play?demo=1'}><span className="role-number">01</span><Smartphone size={23} /><h3>The player</h3><p>Your phone. Your choices.<br />Your group’s next big moment.</p><ArrowRight size={19} /></a><a href={backend ? route('/host') : '/host?demo=1'}><span className="role-number">02</span><Tablet size={23} /><h3>The presenter</h3><p>Pick the question.<br />You decide when it’s go time.</p><ArrowRight size={19} /></a><a href={backend ? route('/display') : '/display?demo=1'}><span className="role-number">03</span><Monitor size={23} /><h3>The big screen</h3><p>A room-sized question.<br />A leaderboard worth looking up for.</p><ArrowRight size={19} /></a></section>
    {!backend && <SetupCard />}
  </main></Frame>;
}
