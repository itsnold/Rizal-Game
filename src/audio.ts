import { useEffect, useRef, useState } from 'react';
import type { Phase, Round } from './model';

const names = ['ui-click', 'quiz-intro', 'round-alert', 'countdown-tick', 'round-start', 'answer-lock', 'final-seconds', 'correct', 'incorrect', 'leaderboard', 'podium'] as const;
type Sound = typeof names[number];
const sounds = new Map<Sound, HTMLAudioElement>();
function sound(name: Sound) {
  if (!sounds.has(name)) {
    const audio = new Audio(name === 'quiz-intro' && import.meta.env.VITE_ROUND_INTRO_URL ? import.meta.env.VITE_ROUND_INTRO_URL : `/assets/audio/${name}.wav`);
    audio.preload = 'auto';
    audio.volume = 0.65;
    sounds.set(name, audio);
  }
  return sounds.get(name)!;
}
export async function playSound(name: Sound) {
  const audio = sound(name);
  audio.currentTime = 0;
  await audio.play();
}

export function useStageAudio(phase: Phase, round: Round | null, now: number) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const fired = useRef(new Set<string>());
  const lastPhase = useRef(phase);
  const enable = async () => {
    try {
      await playSound('ui-click');
      names.forEach(name => sound(name).load());
      setEnabled(true);
      setError('');
    } catch { setError('Tap again to enable sound. Check your browser’s audio permission.'); }
  };
  useEffect(() => {
    const playOnce = (key: string, name: Sound) => {
      if (fired.current.has(key)) return;
      fired.current.add(key);
      if (enabled) void playSound(name).catch(() => setError('Audio is blocked. Tap Enable sound again.'));
    };
    if (round) {
      if (phase === 'intro') {
        // Do not restart the intro track if the display joins halfway through.
        if (round.opensAt - now > 2800) playOnce(`${round.id}:intro`, 'quiz-intro');
      }
      if (phase === 'answering' && now - round.opensAt < 700) playOnce(`${round.id}:go`, 'round-start');
      if (phase === 'answering') {
        const seconds = Math.ceil((round.closesAt - now) / 1000);
        if (seconds >= 1 && seconds <= 5) playOnce(`${round.id}:last:${seconds}`, 'final-seconds');
      }
      if (phase === 'results') playOnce(`${round.id}:results`, 'correct');
    }
    if (lastPhase.current !== phase && (phase === 'leaderboard' || phase === 'ended')) {
      if (enabled) void playSound(phase === 'ended' ? 'podium' : 'leaderboard').catch(() => {});
    }
    lastPhase.current = phase;
  }, [phase, round, now, enabled]);
  return { enabled, error, enable, mute: () => setEnabled(false) };
}
