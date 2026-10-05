export const ANSWER_MS = 20_000;
export const INTRO_MS = 3_000;
export const GRACE_MS = 2_000;
export const COLORS = ['#c7f36b', '#a7c5ff', '#ffbd8a', '#d8b0f3', '#f2df81', '#86d8c5'];
export const SYMBOLS = ['▲', '◆', '●', '■'];
export const LETTERS = ['A', 'B', 'C', 'D'];

export interface Identity { uid: string; email: string; name: string }
export interface Group { id: string; name: string; color: string }
export interface Representative { email: string; groupId: string }
export interface AnswerKey { correctIndex: number; explanation: string }
export interface Question {
  id: string;
  section: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  image?: string;
}
export interface Round {
  id: string;
  questionId: string;
  section: string;
  prompt: string;
  choices: string[];
  image?: string;
  opensAt: number;
  closesAt: number;
  acceptsUntil: number;
  practice: boolean;
  state: 'open' | 'finalized' | 'void';
}
export interface Answer {
  uid: string;
  deviceId: string;
  choice: number;
  elapsedMs: number;
  receivedAt: number;
}
export interface ResultRow {
  groupId: string;
  choice: number;
  correct: boolean;
  elapsedMs: number;
  rank: number;
  points: number;
}
export interface RoundResult {
  roundId: string;
  correctIndex: number;
  explanation: string;
  rows: Record<string, ResultRow>;
  finalizedAt: number;
  practice: boolean;
}
export interface SessionPublic {
  id: string;
  title: string;
  mode: 'waiting' | 'round' | 'leaderboard' | 'ended';
  currentRoundId: string;
  groups: Record<string, Group>;
  rounds?: Record<string, Round>;
  results?: Record<string, RoundResult>;
}
export interface Lease { uid: string; deviceId: string; expiresAt: number }
export interface Session {
  public: SessionPublic;
  submissions?: Record<string, Record<string, Answer>>;
  leases?: Record<string, Lease>;
}
export interface Lobby { title: string; sessionId: string }
export type Phase = 'waiting' | 'intro' | 'answering' | 'collecting' | 'results' | 'void' | 'leaderboard' | 'ended';

export function emailKey(email: string) { return email.trim().toLowerCase().replaceAll('.', ','); }
export function phaseOf(session: SessionPublic | null, now: number): Phase {
  if (!session) return 'waiting';
  if (session.mode !== 'round') return session.mode;
  const round = session.rounds?.[session.currentRoundId];
  if (!round) return 'waiting';
  if (round.state === 'void') return 'void';
  if (round.state === 'finalized') return 'results';
  if (now < round.opensAt) return 'intro';
  if (now < round.closesAt) return 'answering';
  return 'collecting';
}

export function scoreRound(round: Round, question: AnswerKey, groups: Record<string, Group>, answers: Record<string, Answer>, now: number): RoundResult {
  const valid = Object.entries(answers).filter(([id, answer]) => groups[id]
    && Number.isFinite(answer.elapsedMs) && answer.elapsedMs >= 0 && answer.elapsedMs < ANSWER_MS
    && Number.isInteger(answer.choice) && answer.choice >= 0 && answer.choice < round.choices.length
    && Number.isFinite(answer.receivedAt) && answer.receivedAt >= round.opensAt && answer.receivedAt <= round.acceptsUntil);
  const correct = valid.filter(([, answer]) => answer.choice === question.correctIndex)
    .sort((a, b) => a[1].elapsedMs - b[1].elapsedMs);
  const ranks: Record<string, number> = {};
  let previousBucket = -1;
  let rank = 0;
  correct.forEach(([id, answer], index) => {
    const bucket = Math.floor(answer.elapsedMs / 100);
    if (bucket !== previousBucket) rank = index + 1;
    ranks[id] = rank;
    previousBucket = bucket;
  });
  const rows: Record<string, ResultRow> = {};
  Object.keys(groups).forEach(id => {
    const answer = valid.find(([key]) => key === id)?.[1];
    rows[id] = {
      groupId: id, choice: answer?.choice ?? -1, correct: !!ranks[id],
      elapsedMs: answer?.elapsedMs ?? -1, rank: ranks[id] ?? 0,
      points: round.practice || !ranks[id] ? 0 : Math.round(1000 * 0.9 ** (ranks[id] - 1)),
    };
  });
  return { roundId: round.id, correctIndex: question.correctIndex, explanation: question.explanation, rows, finalizedAt: now, practice: round.practice };
}

export function standings(session: SessionPublic | null) {
  if (!session) return [];
  return Object.values(session.groups ?? {}).map(group => {
    let points = 0;
    let correct = 0;
    Object.entries(session.results ?? {}).forEach(([id, result]) => {
      if (result.practice || session.rounds?.[id]?.state !== 'finalized') return;
      const row = result.rows[group.id];
      points += row?.points ?? 0;
      correct += row?.correct ? 1 : 0;
    });
    return { ...group, points, correct };
  }).sort((a, b) => b.points - a.points || b.correct - a.correct || a.name.localeCompare(b.name));
}

export function parseQuestions(input: unknown): Record<string, Question> {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error('Import an array containing 1–100 questions.');
  const result: Record<string, Question> = {};
  input.forEach((raw, index) => {
    const q = raw as Partial<Question>;
    if (!q || typeof q !== 'object' || typeof q.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(q.id)) throw new Error(`Question ${index + 1}: give it a unique id using letters, numbers, - or _.`);
    if (result[q.id]) throw new Error(`Duplicate question id: ${q.id}`);
    if (typeof q.prompt !== 'string' || !q.prompt.trim() || q.prompt.length > 1500) throw new Error(`${q.id}: question text is required (max 1,500 characters).`);
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 4 || q.choices.some(c => typeof c !== 'string' || !c.trim() || c.length > 250)) throw new Error(`${q.id}: provide 2–4 nonempty choices (max 250 characters each).`);
    if (!Number.isInteger(q.correctIndex) || q.correctIndex! < 0 || q.correctIndex! >= q.choices.length) throw new Error(`${q.id}: correctIndex must be a choice number, starting at 0.`);
    if (q.image && (typeof q.image !== 'string' || !(q.image.startsWith('/assets/') || q.image.startsWith('https://')))) throw new Error(`${q.id}: images must use /assets/ or an https:// URL.`);
    if ((q.section && typeof q.section !== 'string') || (q.explanation && typeof q.explanation !== 'string')) throw new Error(`${q.id}: section and explanation must be text.`);
    result[q.id] = { id: q.id, section: q.section?.trim() || 'Presentation', prompt: q.prompt.trim(), choices: q.choices.map(c => c.trim()), correctIndex: q.correctIndex!, explanation: q.explanation?.trim() || '', ...(q.image ? { image: q.image } : {}) };
  });
  return result;
}

export function parseRoster(text: string): { groups: Record<string, Group>; roster: Record<string, Representative> } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length || lines.length > 80) throw new Error('Add 1–80 groups, one per line: Group name, email@addu.edu.ph');
  const groups: Record<string, Group> = {};
  const roster: Record<string, Representative> = {};
  const names = new Set<string>();
  lines.forEach((line, index) => {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length !== 2 || !parts[0] || parts[0].length > 60 || !/^[a-z0-9._+-]+@addu\.edu\.ph$/i.test(parts[1])) throw new Error(`Line ${index + 1}: use Group name, representative@addu.edu.ph`);
    const key = emailKey(parts[1]);
    if (roster[key]) throw new Error(`Email appears twice: ${parts[1]}`);
    if (names.has(parts[0].toLowerCase())) throw new Error(`Group appears twice: ${parts[0]}`);
    names.add(parts[0].toLowerCase());
    const id = `group-${index + 1}`;
    groups[id] = { id, name: parts[0], color: COLORS[index % COLORS.length] };
    roster[key] = { email: parts[1].toLowerCase(), groupId: id };
  });
  return { groups, roster };
}
