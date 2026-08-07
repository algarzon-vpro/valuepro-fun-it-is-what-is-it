import { useEffect, useState } from 'react';
import type { GameApi } from '../hooks/useGame';

export function useCountdown(endsAt: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return left;
}

export function ResultsOverlay({ game }: { game: GameApi }) {
  const { state, me, startGame, endGame, leaveToHome } = game;
  if (!state) return null;
  const isHost = me?.isHost || game.playerId === state.hostId;

  if (state.phase === 'roundResults') {
    return (
      <div className="screen-center" style={{ background: 'rgba(6,4,16,0.72)', zIndex: 25 }}>
        <div className="overlay-card">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: 'var(--cyan)' }}>
            Round complete
          </h2>
          <p style={{ color: 'var(--pink)', letterSpacing: '0.12em' }}>WORD: {state.revealedWord}</p>
          <ul className="results-list">
            {(state.roundResults ?? []).map((s) => (
              <li key={`${s.playerId}-${s.isDrawer}`}>
                <span>
                  {s.isDrawer ? 'Drawer · ' : `#${s.placement} `}
                  {s.playerName}
                </span>
                <span style={{ color: 'var(--orange)' }}>+{s.pointsAwarded}</span>
              </li>
            ))}
          </ul>
          <p style={{ color: 'var(--muted)' }}>Next round starting automatically…</p>
        </div>
      </div>
    );
  }

  if (state.phase === 'finalScoreboard') {
    return (
      <div className="screen-center" style={{ background: 'rgba(6,4,16,0.8)', zIndex: 25 }}>
        <div className="overlay-card">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: 'var(--cyan)' }}>
            Final scoreboard
          </h2>
          <ul className="results-list">
            {(state.finalScores ?? []).map((p, i) => (
              <li key={p.playerId}>
                <span>
                  #{i + 1} {p.playerName}
                </span>
                <span style={{ color: 'var(--cyan)' }}>{p.score}</span>
              </li>
            ))}
          </ul>
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {isHost && (
              <>
                <button type="button" className="btn primary" onClick={startGame}>
                  Play again
                </button>
                <button type="button" className="btn" onClick={endGame}>
                  Back to lobby
                </button>
              </>
            )}
            <button type="button" className="btn danger" onClick={leaveToHome}>
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
