import { useState } from 'react';
import { Check, LoaderCircle, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PRIMARY_CONTROLLER } from './access';
import { backend, friendlyError } from './backend';
import { ErrorNotice } from './components';
import { useValue } from './hooks';
import { emailKey } from './model';

export default function ControllerManager({ connected }: { connected: boolean }) {
  const controllers = useValue<Record<string, boolean>>('controllers');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState('');
  async function add() {
    if (!backend) return;
    setBusy(true); setError('');
    try {
      const address = email.trim().toLowerCase();
      if (!/^[a-z0-9._+-]+@addu\.edu\.ph$/.test(address)) throw new Error('Enter the controller’s exact addu.edu.ph email.');
      if (address === PRIMARY_CONTROLLER || controllers.value?.[emailKey(address)]) throw new Error('That email already has controller access.');
      await backend.write(`controllers/${emailKey(address)}`, true);
      setEmail('');
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  }
  return <section className="card manager-panel"><div className="section-heading"><div><h2><ShieldCheck size={20} /> Game controllers</h2><p className="manager-subtitle">Controllers can edit questions, manage groups, and run rounds. Only you can add or remove controllers.</p></div></div>
    <ErrorNotice>{error || controllers.error}</ErrorNotice>
    <form className="controller-add" onSubmit={e => { e.preventDefault(); void add(); }}><label className="sr-only" htmlFor="controller-email">Controller school email</label><input id="controller-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="controller@addu.edu.ph" disabled={busy} /><button className="button primary" disabled={busy || !connected} type="submit">{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add controller</button></form>
    <div className="manager-list"><div className="manager-row"><ShieldCheck size={19} /><span><strong>{PRIMARY_CONTROLLER}</strong><small>Primary controller · permanent owner</small></span><Check size={17} /></div>{Object.entries(controllers.value ?? {}).filter(([key, enabled]) => enabled && key !== emailKey(PRIMARY_CONTROLLER)).map(([key]) => <div className="manager-row" key={key}><span><strong>{key.replaceAll(',', '.')}</strong><small>Controller</small></span><button className="icon-button danger-icon" aria-label={`Remove controller ${key.replaceAll(',', '.')}`} title="Remove controller" disabled={busy || !connected} onClick={() => setRemove(key)}><Trash2 size={16} /></button></div>)}</div>
    {remove && <div className="modal-backdrop"><section className="modal card" role="dialog" aria-modal="true" aria-labelledby="remove-controller-title"><h2 id="remove-controller-title">Remove controller?</h2><p>{remove.replaceAll(',', '.')} will lose control-room access immediately.</p><div className="button-row"><button className="button danger" disabled={busy || !connected} onClick={() => { setBusy(true); void backend!.write(`controllers/${remove}`, null).then(() => setRemove('')).catch(e => setError(friendlyError(e))).finally(() => setBusy(false)); }}><Trash2 size={16} /> Remove</button><button className="button secondary" disabled={busy} onClick={() => setRemove('')}>Cancel</button></div><ErrorNotice>{error}</ErrorNotice></section></div>}
  </section>;
}
