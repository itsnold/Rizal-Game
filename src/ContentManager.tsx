import { useState } from 'react';
import { Check, Edit3, LoaderCircle, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { backend, friendlyError } from './backend';
import { id } from './game-service';
import { COLORS, LETTERS, emailKey, parseQuestions, type Group, type Question, type Representative, type SessionPublic } from './model';
import { ErrorNotice } from './components';

interface Props {
  questions: Record<string, Question>;
  roster: Record<string, Representative>;
  session: SessionPublic | null;
  connected: boolean;
}

export function QuestionManager({ questions, connected }: Pick<Props, 'questions' | 'connected'>) {
  const [draft, setDraft] = useState<Question | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState<Question | null>(null);
  const [filter, setFilter] = useState('');
  async function save() {
    if (!draft || !backend) return;
    setBusy(true); setError('');
    try {
      const question = parseQuestions([draft])[draft.id];
      await backend.write(`questions/${question.id}`, question);
      setDraft(null);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  }
  function edit(q?: Question) {
    setError(''); setIsNew(!q);
    setDraft(q ? { ...q, choices: [...q.choices] } : { id: `question-${id()}`, section: '', prompt: '', choices: ['', '', '', ''], correctIndex: 0, explanation: '' });
  }
  return <section className="card manager-panel">
    <div className="section-heading"><div><h2>Questions</h2><p className="manager-subtitle">Add, edit, and save directly. Changes sync to your other host devices.</p></div><button className="button primary" disabled={!connected || busy} onClick={() => edit()}><Plus size={16} /> Add question</button></div>
    <ErrorNotice>{error}</ErrorNotice>
    <input className="manager-search" aria-label="Find a question to edit" placeholder="Find a question…" value={filter} onChange={e => setFilter(e.target.value)} />
    <div className="manager-list">{Object.values(questions).filter(q => `${q.prompt} ${q.section}`.toLowerCase().includes(filter.toLowerCase())).map(q => <div className="manager-row" key={q.id}><span><strong>{q.prompt}</strong><small>{q.section} · Answer {LETTERS[q.correctIndex]}</small></span><button className="icon-button" title="Edit question" aria-label={`Edit question ${q.prompt}`} disabled={!connected || busy} onClick={() => edit(q)}><Edit3 size={16} /></button><button className="icon-button danger-icon" title="Delete question" aria-label={`Delete question ${q.prompt}`} disabled={!connected || busy} onClick={() => setRemove(q)}><Trash2 size={16} /></button></div>)}{!Object.keys(questions).length && <p className="manager-empty">No questions yet. Add your first question above.</p>}</div>
    {draft && <div className="modal-backdrop"><form className="modal card editor-modal" role="dialog" aria-modal="true" aria-labelledby="question-editor-title" onSubmit={e => { e.preventDefault(); void save(); }}><div className="section-heading"><h2 id="question-editor-title">{isNew ? 'Add question' : 'Edit question'}</h2><button type="button" className="icon-button" aria-label="Close question editor" disabled={busy} onClick={() => setDraft(null)}><X size={20} /></button></div>
      <label htmlFor="edit-section">Section / slide reference</label><input id="edit-section" value={draft.section} maxLength={100} onChange={e => setDraft({ ...draft, section: e.target.value })} placeholder="Optional" />
      <label htmlFor="edit-prompt">Question</label><textarea id="edit-prompt" required rows={3} maxLength={1500} value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })} placeholder="What do you want to ask?" />
      <div className="section-heading choice-editor-heading"><label>Choices</label><select aria-label="Number of choices" value={draft.choices.length} onChange={e => { const count = Number(e.target.value); setDraft({ ...draft, choices: Array.from({ length: count }, (_, i) => draft.choices[i] ?? ''), correctIndex: Math.min(draft.correctIndex, count - 1) }); }}><option value={2}>2 choices</option><option value={3}>3 choices</option><option value={4}>4 choices</option></select></div>
      <div className="choice-editor">{draft.choices.map((choice, index) => <div className={`choice-editor-row ${draft.correctIndex === index ? 'correct-choice' : ''}`} key={index}><label className="correct-choice-radio" title="Mark correct answer"><input type="radio" name="correct-answer" checked={draft.correctIndex === index} onChange={() => setDraft({ ...draft, correctIndex: index })} aria-label={`Choice ${LETTERS[index]} is correct`} /><span>{LETTERS[index]}</span></label><input required aria-label={`Choice ${LETTERS[index]}`} maxLength={250} value={choice} onChange={e => setDraft({ ...draft, choices: draft.choices.map((old, i) => i === index ? e.target.value : old) })} placeholder={`Choice ${LETTERS[index]}`} />{draft.correctIndex === index && <Check size={18} />}</div>)}</div><small className="editor-hint">Select the circle next to the correct choice.</small>
      <label htmlFor="edit-explanation">Result explanation</label><textarea id="edit-explanation" rows={2} value={draft.explanation} maxLength={2000} onChange={e => setDraft({ ...draft, explanation: e.target.value })} placeholder="Optional" />
      <label htmlFor="edit-image">Image URL</label><input id="edit-image" value={draft.image ?? ''} onChange={e => { const next = { ...draft }; if (e.target.value) next.image = e.target.value; else delete next.image; setDraft(next); }} placeholder="Optional: /assets/image.jpg or https://…" />
      <ErrorNotice>{error}</ErrorNotice><div className="button-row"><button className="button primary" type="submit" disabled={busy || !connected}>{busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} Save question</button><button type="button" className="button secondary" disabled={busy} onClick={() => setDraft(null)}>Cancel</button></div>
    </form></div>}
    {remove && <div className="modal-backdrop"><section className="modal card" role="dialog" aria-modal="true" aria-labelledby="delete-question-title"><h2 id="delete-question-title">Delete question?</h2><p>{remove.prompt}</p><p>Existing rounds and scores stay saved. A running round keeps its original answer key.</p><div className="button-row"><button className="button danger" disabled={busy || !connected} onClick={() => { setBusy(true); void backend!.write(`questions/${remove.id}`, null).then(() => setRemove(null)).catch(e => setError(friendlyError(e))).finally(() => setBusy(false)); }}><Trash2 size={16} /> Delete</button><button className="button secondary" disabled={busy} onClick={() => setRemove(null)}>Cancel</button></div><ErrorNotice>{error}</ErrorNotice></section></div>}
  </section>;
}

export function RosterManager({ roster, session, connected }: Pick<Props, 'roster' | 'session' | 'connected'>) {
  const [draft, setDraft] = useState<{ originalKey: string; groupId: string; email: string; name: string; color: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Representative | null>(null);
  const active = session?.rounds?.[session.currentRoundId]?.state === 'open';
  const groups = session?.groups ?? {};
  const members = Object.entries(roster).filter(([, rep]) => groups[rep.groupId]);
  async function save() {
    if (!backend || !session || !draft) return;
    setBusy(true); setError('');
    try {
      const email = draft.email.trim().toLowerCase();
      if (!/^[a-z0-9._+-]+@addu\.edu\.ph$/.test(email)) throw new Error('Use the representative’s exact addu.edu.ph email.');
      const key = emailKey(email);
      if (roster[key] && key !== draft.originalKey) throw new Error('That email is already authorized for another group.');
      const name = draft.name.trim();
      if (!name || name.length > 60) throw new Error('Enter a group name (1–60 characters).');
      if (Object.values(groups).some(g => g.id !== draft.groupId && g.name.toLowerCase() === name.toLowerCase())) throw new Error('Another group already has that name.');
      const existing = !!draft.originalKey;
      const changedEmail = existing && key !== draft.originalKey;
      if (Object.entries(roster).some(([oldKey, rep]) => rep.groupId === draft.groupId && oldKey !== draft.originalKey)) throw new Error('That group already has an authorized representative. Edit their existing entry instead.');
      if (active && (!existing || changedEmail)) throw new Error('Finish or void the live round before changing authorized emails. Group names can still be updated now.');
      if (!groups[draft.groupId] && Object.keys(groups).length >= 80) throw new Error('This session already has 80 groups.');
      const patch: Record<string, unknown> = {
        [`roster/${key}`]: { email, groupId: draft.groupId },
        [`sessions/${session.id}/public/groups/${draft.groupId}`]: { id: draft.groupId, name, color: draft.color } satisfies Group,
      };
      if (changedEmail) {
        patch[`roster/${draft.originalKey}`] = null;
        patch[`sessions/${session.id}/leases/${draft.groupId}`] = null;
        patch[`presence/${session.id}/${draft.groupId}`] = null;
      }
      await backend.patch(patch);
      setDraft(null);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  }
  return <section className="card manager-panel"><div className="section-heading"><div><h2><Users size={20} /> Authorized representatives</h2><p className="manager-subtitle">Exact-email access. Edit group names without resetting scores.</p></div><button className="button primary" disabled={!session || active || !connected || busy} onClick={() => { setError(''); setDraft({ originalKey: '', groupId: `group-${id()}`, email: '', name: '', color: COLORS[Object.keys(groups).length % COLORS.length] }); }}><Plus size={16} /> Authorize email</button></div><ErrorNotice>{error}</ErrorNotice>
    {active && <p className="editor-hint">Group names can change now. Email authorization changes unlock after this round.</p>}
    <div className="manager-list">{members.map(([key, rep]) => <div className="manager-row" key={key}><span className="group-avatar" style={{ background: groups[rep.groupId].color }}>{groups[rep.groupId].name[0]}</span><span><strong>{groups[rep.groupId].name}</strong><small>{rep.email}</small></span><button className="icon-button" title="Edit representative" aria-label={`Edit representative ${rep.email}`} disabled={!connected || busy} onClick={() => { setError(''); setDraft({ originalKey: key, groupId: rep.groupId, email: rep.email, name: groups[rep.groupId].name, color: groups[rep.groupId].color }); }}><Edit3 size={16} /></button><button className="icon-button danger-icon" title="Revoke authorization" aria-label={`Revoke ${rep.email}`} disabled={active || !connected || busy} onClick={() => setRemove(rep)}><Trash2 size={16} /></button></div>)}</div>
    {!session && <p className="manager-empty">Create a session in Setup first.</p>}
    {draft && <div className="modal-backdrop"><form className="modal card editor-modal" role="dialog" aria-modal="true" aria-labelledby="representative-editor-title" onSubmit={e => { e.preventDefault(); void save(); }}><div className="section-heading"><h2 id="representative-editor-title">{draft.originalKey ? 'Edit representative' : 'Authorize representative'}</h2><button type="button" className="icon-button" aria-label="Close representative editor" disabled={busy} onClick={() => setDraft(null)}><X size={20} /></button></div>
      <label htmlFor="representative-email">Authorized school email</label><input id="representative-email" type="email" required value={draft.email} disabled={active} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="representative@addu.edu.ph" />
      {!draft.originalKey && <><label htmlFor="representative-existing-group">Assign to</label><select id="representative-existing-group" value={groups[draft.groupId] ? draft.groupId : 'new'} onChange={e => { const existing = groups[e.target.value]; setDraft(existing ? { ...draft, groupId: existing.id, name: existing.name, color: existing.color } : { ...draft, groupId: `group-${id()}`, name: '', color: COLORS[Object.keys(groups).length % COLORS.length] }); }}><option value="new">New group</option>{Object.values(groups).filter(g => !Object.values(roster).some(rep => rep.groupId === g.id)).map(g => <option key={g.id} value={g.id}>{g.name} — keep existing scores</option>)}</select></>}
      <label htmlFor="representative-group">Group name</label><input id="representative-group" required maxLength={60} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Group 1" />
      <label>Group color</label><div className="color-picker">{COLORS.map(color => <button key={color} type="button" aria-label={`Group color ${color}`} className={draft.color === color ? 'chosen' : ''} style={{ background: color }} onClick={() => setDraft({ ...draft, color })}>{draft.color === color && <Check size={18} />}</button>)}</div>
      <ErrorNotice>{error}</ErrorNotice><div className="button-row"><button className="button primary" disabled={busy || !connected} type="submit">{busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save representative</button><button className="button secondary" type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button></div>
    </form></div>}
    {remove && <div className="modal-backdrop"><section className="modal card" role="dialog" aria-modal="true" aria-labelledby="revoke-title"><h2 id="revoke-title">Revoke this email?</h2><p>{remove.email} will lose player access immediately. The group and its earned points remain saved.</p><div className="button-row"><button className="button danger" disabled={busy || !connected} onClick={() => { setBusy(true); void backend!.patch({ [`roster/${emailKey(remove.email)}`]: null, [`sessions/${session!.id}/leases/${remove.groupId}`]: null, [`presence/${session!.id}/${remove.groupId}`]: null }).then(() => setRemove(null)).catch(e => setError(friendlyError(e))).finally(() => setBusy(false)); }}><Trash2 size={16} /> Revoke</button><button className="button secondary" disabled={busy} onClick={() => setRemove(null)}>Cancel</button></div><ErrorNotice>{error}</ErrorNotice></section></div>}
  </section>;
}
