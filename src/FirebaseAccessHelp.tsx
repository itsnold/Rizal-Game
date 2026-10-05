import { useState } from 'react';
import { Check, Copy, Download, ExternalLink, RotateCcw, ShieldCheck } from 'lucide-react';
import databaseRules from '../database.rules.json';
import { ErrorNotice } from './components';
import { PRIMARY_CONTROLLER } from './access';

const rulesText = JSON.stringify(databaseRules, null, 2);

export default function FirebaseAccessHelp({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'rizal-game';
  const consoleUrl = `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/database`;
  async function copy() {
    try { await navigator.clipboard.writeText(rulesText); setCopied(true); setError(''); }
    catch { setError('Clipboard access is blocked. Use Download rules, or copy the rules shown below.'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([rulesText], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'database.rules.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="card access-card firebase-access-help"><ShieldCheck size={32} /><h1>Publish the Firebase rules.</h1>
    <p>You’re signed in as <strong>{email}</strong>. The live database is rejecting the app’s reads. Publishing the website on Vercel does not publish Firebase permissions.</p>
    <ol className="setup-steps"><li>Click <strong>Copy Firebase rules</strong>.</li><li>Open Firebase → <strong>Realtime Database → Rules</strong>.</li><li>Replace the existing rules with the copied rules and click <strong>Publish</strong>.</li><li>Return here and click <strong>Reload controls</strong>.</li></ol>
    <div className="button-row"><button className="button primary" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Rules copied' : 'Copy Firebase rules'}</button><a className="button secondary" href={consoleUrl} target="_blank" rel="noreferrer">Open Firebase <ExternalLink size={15} /></a><button className="button secondary" onClick={() => location.reload()}><RotateCcw size={15} /> Reload controls</button><button className="button ghost" onClick={download}><Download size={15} /> Download rules</button></div>
    <ErrorNotice>{error}</ErrorNotice>
    <p className="small">These rules grant <strong>{PRIMARY_CONTROLLER}</strong> primary-controller access and enforce the app’s controller list, player whitelist, and answer deadlines.</p>
    <details className="firebase-rules-details"><summary>Show the rules</summary><textarea readOnly value={rulesText} aria-label="Firebase database rules" spellCheck={false} onFocus={e => e.currentTarget.select()} /></details>
  </section>;
}
