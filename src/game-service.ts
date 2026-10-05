import { backend } from './backend';
import { ANSWER_MS, GRACE_MS, INTRO_MS, scoreRound, type AnswerKey, type Group, type Question, type Representative, type Round, type Session, type SessionPublic } from './model';

function store() { if (!backend) throw new Error('Connect a Firebase project first.'); return backend; }
export function id() { return crypto.randomUUID(); }

export async function createSession(title: string, groups: Record<string, Group>, roster: Record<string, Representative>) {
  const sessionId = id();
  await store().patch({
    [`sessions/${sessionId}`]: { public: { id: sessionId, title, mode: 'waiting', currentRoundId: '', groups } },
    lobby: { title, sessionId }, roster,
  });
  return sessionId;
}

export async function resetSession(previousId: string) {
  const current = await store().read<SessionPublic>(`sessions/${previousId}/public`);
  if (!current) throw new Error('The current session could not be found.');
  const sessionId = id();
  const patch: Record<string, unknown> = {
    [`sessions/${sessionId}`]: { public: { id: sessionId, title: current.title, mode: 'waiting', currentRoundId: '', groups: current.groups ?? {} } },
    [`sessions/${previousId}/public/mode`]: 'ended',
    lobby: { title: current.title, sessionId },
  };
  const unfinished = current.rounds?.[current.currentRoundId];
  if (unfinished?.state === 'open') {
    patch[`sessions/${previousId}/public/rounds/${unfinished.id}/state`] = 'void';
    patch[`sessions/${previousId}/public/results/${unfinished.id}`] = null;
  }
  // Only session state and the live pointer change. The roster, bank, and
  // controller list are deliberately not rewritten, preserving concurrent edits.
  await store().patch(patch);
  return sessionId;
}

export async function launchRound(sessionId: string, question: Question, practice: boolean, now: number) {
  const roundId = id();
  const opensAt = now + INTRO_MS + 1_000;
  const round: Round = {
    id: roundId, questionId: question.id, section: question.section, prompt: question.prompt,
    choices: question.choices, ...(question.image ? { image: question.image } : {}),
    opensAt, closesAt: opensAt + ANSWER_MS, acceptsUntil: opensAt + ANSWER_MS + GRACE_MS,
    practice, state: 'open',
  };
  await store().write(`roundKeys/${sessionId}/${roundId}`, { correctIndex: question.correctIndex, explanation: question.explanation });
  const committed = await store().transact<Session>(`sessions/${sessionId}`, current => {
    if (!current) return undefined;
    const active = current.public.rounds?.[current.public.currentRoundId];
    if (active?.state === 'open') return undefined;
    current.public.mode = 'round';
    current.public.currentRoundId = roundId;
    current.public.rounds = { ...current.public.rounds, [roundId]: round };
    return current;
  });
  if (!committed) throw new Error('A round is already running, or the session changed.');
}

export async function finalizeRound(sessionId: string, roundId: string, question: Question | null, now: number) {
  const key = await store().read<AnswerKey>(`roundKeys/${sessionId}/${roundId}`) ?? question;
  if (!key) throw new Error('This round’s answer key is missing. Restore the question bank or void the round.');
  return store().transact<Session>(`sessions/${sessionId}`, current => {
    const round = current?.public.rounds?.[roundId];
    if (!current || !round || round.state !== 'open' || now <= round.acceptsUntil) return undefined;
    const result = scoreRound(round, key, current.public.groups ?? {}, current.submissions?.[roundId] ?? {}, now);
    round.state = 'finalized';
    current.public.results = { ...current.public.results, [roundId]: result };
    return current;
  });
}

export async function voidRound(sessionId: string, roundId: string) {
  await store().transact<Session>(`sessions/${sessionId}`, current => {
    const round = current?.public.rounds?.[roundId];
    if (!current || !round) return undefined;
    round.state = 'void';
    if (current.public.results) delete current.public.results[roundId];
    return current;
  });
}

export async function changeMode(sessionId: string, mode: Session['public']['mode']) {
  const committed = await store().transact<Session>(`sessions/${sessionId}`, current => {
    if (!current || current.public.rounds?.[current.public.currentRoundId]?.state === 'open') return undefined;
    current.public.mode = mode;
    return current;
  });
  if (!committed) throw new Error('Finish or void the current round first.');
}
