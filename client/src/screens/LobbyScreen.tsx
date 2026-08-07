import type { GameApi } from '../hooks/useGame';
import { Leaderboard } from '../components/Leaderboard';

type Props = { game: GameApi };

export function LobbyScreen({ game }: Props) {
  const { state, me, playerId } = game;
  if (!state) return null;

  const isHost = playerId === state.hostId;
  const { settings } = state;
  const isSpectator = me?.role === 'spectator';

  return (
    <div className="lobby-grid">
      <div className="lobby-card">
        <div>
          <p className="pixel-label">Room code</p>
          <div className="room-code">{state.code}</div>
          <p className="tagline" style={{ marginTop: '0.75rem' }}>
            Share the code — host starts when the squad is ready.
          </p>

          <h2 className="side-title" style={{ marginTop: '1.1rem' }}>
            Players ({state.players.length}/{settings.maxPlayers})
          </h2>
          <Leaderboard
            players={state.players}
            spectators={[]}
            hostId={state.hostId}
            isHost={isHost}
            onKick={isHost ? game.kickPlayer : undefined}
            showTopGuessers={false}
          />

          {state.spectators.length > 0 && (
            <>
              <h2 className="side-title" style={{ marginTop: '1rem' }}>
                Spectators
              </h2>
              <Leaderboard
                players={[]}
                spectators={state.spectators}
                hostId={state.hostId}
                isHost={isHost}
                onKick={isHost ? game.kickPlayer : undefined}
                showTopGuessers={false}
              />
            </>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '1rem' }}>
            {isSpectator && state.canJoinAsPlayer && (
              <button type="button" className="menu-btn" style={{ width: 'auto', margin: 0 }} onClick={game.promoteSpectator}>
                Join as player
              </button>
            )}
            {isHost && (
              <button type="button" className="menu-btn primary" style={{ width: 'auto', margin: 0 }} onClick={game.startGame}>
                Start game
              </button>
            )}
            <button type="button" className="menu-btn danger" style={{ width: 'auto', margin: 0 }} onClick={game.leaveToHome}>
              Leave
            </button>
          </div>
        </div>

        <div>
          <h2 className="side-title">Room settings</h2>
          <label className="menu-field">
            Round duration (sec)
            <input
              type="number"
              min={30}
              max={300}
              disabled={!isHost}
              value={settings.roundDurationSec}
              onChange={(e) => game.updateSettings({ roundDurationSec: Number(e.target.value) })}
            />
          </label>
          <label className="menu-field">
            Number of rounds
            <input
              type="number"
              min={1}
              max={20}
              disabled={!isHost}
              value={settings.totalRounds}
              onChange={(e) => game.updateSettings({ totalRounds: Number(e.target.value) })}
            />
          </label>
          <label className="menu-field">
            Max players
            <input
              type="number"
              min={2}
              max={16}
              disabled={!isHost}
              value={settings.maxPlayers}
              onChange={(e) => game.updateSettings({ maxPlayers: Number(e.target.value) })}
            />
          </label>

          {!isHost && (
            <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>
              Waiting for host to launch…
            </p>
          )}

          {isHost && (
            <button type="button" className="menu-btn danger" style={{ marginTop: '1rem' }} onClick={game.endGame}>
              Reset lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
