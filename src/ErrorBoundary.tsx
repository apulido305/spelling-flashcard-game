import { Component, type ReactNode } from 'react';
import { clearSavedSession } from './App';

interface State {
  crashed: boolean;
}

// Last line of defense against a blank page: without this, any render error
// unmounts the whole tree and leaves a white screen - and if the cause is
// saved session data, it repeats on every reload. Clearing the in-progress
// session (mastery, saved lists, and settings are kept) lets "Start over"
// recover without the family having to clear browser data by hand.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
    clearSavedSession();
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="app-card">
        <h1>Oops! Something went wrong.</h1>
        <p>Your saved lists and progress are safe.</p>
        <button type="button" onClick={() => location.reload()}>
          Start over
        </button>
      </div>
    );
  }
}
