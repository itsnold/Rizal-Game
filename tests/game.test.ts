import { describe, expect, it } from 'vitest';
import { ANSWER_MS, emailKey, parseQuestions, parseRoster, phaseOf, scoreRound, standings, type Answer, type Group, type Question, type Round, type SessionPublic } from '../src/model';

const groups: Record<string, Group> = Object.fromEntries(['a', 'b', 'c', 'd'].map(id => [id, { id, name: id, color: '#fff' }]));
const question: Question = { id: 'q1', section: 'Section', prompt: 'Question?', choices: ['Right', 'Wrong'], correctIndex: 0, explanation: 'Because.' };
const round: Round = { id: 'r1', questionId: 'q1', section: 'Section', prompt: 'Question?', choices: question.choices, opensAt: 10_000, closesAt: 30_000, acceptsUntil: 32_000, practice: false, state: 'open' };
function answer(elapsedMs: number, receivedAt = 15_000, choice = 0): Answer { return { uid: 'rep', deviceId: 'phone', choice, elapsedMs, receivedAt }; }
function session(result = scoreRound(round, question, groups, {}, 33_000)): SessionPublic { return { id: 's1', title: 'Game', mode: 'round', currentRoundId: round.id, groups, rounds: { r1: { ...round, state: 'finalized' } }, results: { r1: result } }; }

describe('ranking and scores', () => {
  it('ranks tap times rather than upload order', () => {
    const result = scoreRound(round, question, groups, { a: answer(900, 18_000), b: answer(1500, 16_000), c: answer(1600, 17_000, 1) }, 33_000);
    expect(result.rows.a.points).toBe(1000);
    expect(result.rows.b.points).toBe(900);
    expect(result.rows.c.points).toBe(0);
    expect(result.rows.d.choice).toBe(-1);
  });
  it('shares rank for the same 100-ms bucket and uses competition ranking', () => {
    const result = scoreRound(round, question, groups, { a: answer(210), b: answer(299), c: answer(300), d: answer(411) }, 33_000);
    expect(Object.values(result.rows).map(r => [r.rank, r.points])).toEqual([[1, 1000], [1, 1000], [3, 810], [4, 729]]);
  });
  it('accepts a late upload of an in-time tap only within transport grace', () => {
    const result = scoreRound(round, question, groups, { a: answer(19_999, 31_999), b: answer(20_000, 31_000), c: answer(100, 32_001) }, 33_000);
    expect(result.rows.a.correct).toBe(true);
    expect(result.rows.b.correct).toBe(false);
    expect(result.rows.c.correct).toBe(false);
  });
  it('excludes impossible and unknown submissions', () => {
    const result = scoreRound(round, question, groups, { a: answer(-1), b: answer(NaN), c: answer(1, 9000), intruder: answer(1) }, 33_000);
    expect(Object.values(result.rows).every(r => r.points === 0)).toBe(true);
    expect(result.rows.intruder).toBeUndefined();
  });
  it('keeps practice rounds out of points and cumulative correct counts', () => {
    const result = scoreRound({ ...round, practice: true }, question, groups, { a: answer(100) }, 33_000);
    expect(result.rows.a.correct).toBe(true);
    expect(result.rows.a.points).toBe(0);
    expect(standings(session(result)).find(r => r.id === 'a')).toMatchObject({ points: 0, correct: 0 });
  });
  it('derives totals from round results so voiding removes the points', () => {
    const data = session(scoreRound(round, question, groups, { a: answer(100) }, 33_000));
    expect(standings(data)[0].points).toBe(1000);
    data.rounds!.r1.state = 'void';
    expect(standings(data)[0].points).toBe(0);
  });
});

describe('round boundaries', () => {
  it('uses shared boundaries, with no early finish when everyone answers', () => {
    const data = { ...session(), rounds: { r1: round } };
    expect(phaseOf(data, 9999)).toBe('intro');
    expect(phaseOf(data, 10_000)).toBe('answering');
    expect(phaseOf(data, 29_999)).toBe('answering');
    expect(phaseOf(data, 30_000)).toBe('collecting');
    expect(phaseOf(data, 40_000)).toBe('collecting');
    data.rounds.r1 = { ...round, state: 'finalized' };
    expect(phaseOf(data, 40_000)).toBe('results');
    expect(round.closesAt - round.opensAt).toBe(ANSWER_MS);
  });
});

describe('pre-edited content validation', () => {
  it('accepts the question format and rejects duplicate IDs/invalid correct answers', () => {
    expect(parseQuestions([question]).q1.correctIndex).toBe(0);
    expect(() => parseQuestions([question, question])).toThrow('Duplicate');
    expect(() => parseQuestions([{ ...question, correctIndex: 2 }])).toThrow('correctIndex');
    expect(() => parseQuestions([{ ...question, image: 'javascript:alert(1)' }])).toThrow('images');
  });
  it('normalizes exact email keys and rejects duplicate representatives or groups', () => {
    const result = parseRoster('Team A, First.Last@addu.edu.ph\nTeam B, second@addu.edu.ph');
    expect(result.roster[emailKey('first.last@addu.edu.ph')].groupId).toBe('group-1');
    expect(() => parseRoster('A, someone@gmail.com')).toThrow('Line 1');
    expect(() => parseRoster('A, first@addu.edu.ph\nB, first@addu.edu.ph')).toThrow('twice');
    expect(() => parseRoster('A, first@addu.edu.ph\na, second@addu.edu.ph')).toThrow('twice');
  });
});
