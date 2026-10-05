import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './Landing';
import Host from './Host';
import Player from './Player';
import Display from './Display';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); }
  render() {
    if (this.state.error) return <main className="narrow"><section className="card access-card"><h1>Let’s get back on track.</h1><p>{this.state.error}</p><p>Your Firebase answers and results remain saved.</p><button className="button primary" onClick={() => location.reload()}>Reload the page</button></section></main>;
    return this.props.children;
  }
}

const page = location.pathname.replace(/\/$/, '') || '/';
const Screen = page === '/host' ? Host : page === '/play' ? Player : page === '/display' ? Display : Landing;
createRoot(document.getElementById('root')!).render(<ErrorBoundary><Screen /></ErrorBoundary>);
