import type { PlayerPublic } from '@it-is-what-is-it/shared';

type TopGuesser = { playerId: string; playerName: string; placement: number };

type Props = {
  players: PlayerPublic[];
  spectators: PlayerPublic[];
  topGuessers?: TopGuesser[];
  hostId?: string;
  isHost?: boolean;
  onKick?: (playerId: string) => void;
  showTopGuessers?: boolean;
};

const STATUS_LABEL: Record<PlayerPublic['status'], string> = {
  drawing: 'Drawing',
  guessing: 'Guessing',
  guessed: 'Guessed',
  spectating: 'Spectating',
  lobby: 'Ready',
};

function PlayerRows({
  list,
  hostId,
  isHost,
  onKick,
}: {
  list: PlayerPublic[];
  hostId?: string;
  isHost?: boolean;
  onKick?: (playerId: string) => void;
}) {
  return (
    <>
      {list.map((p) => (
        <div className="player-row" key={p.id}>
          <div>
            <div className="name">
              {p.name}
              {hostId && p.id === hostId && (
                <span className="badge orange" style={{ marginLeft: '0.35rem' }}>
                  Host
                </span>
              )}
              {!p.connected && (
                <span className="badge" style={{ marginLeft: '0.35rem', opacity: 0.6 }}>
                  Offline
                </span>
              )}
            </div>
            <div className="meta">
              <span className={`status-chip ${p.status}`}>{STATUS_LABEL[p.status]}</span>
              {p.guessPlacement != null && (
                <span style={{ marginLeft: '0.4rem' }}>#{p.guessPlacement}</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="score">{p.score}</div>
            {isHost && onKick && hostId && p.id !== hostId && (
              <button type="button" className="kick-btn" onClick={() => onKick(p.id)}>
                Kick
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export function Leaderboard({
  players,
  spectators,
  topGuessers = [],
  hostId,
  isHost,
  onKick,
  showTopGuessers = true,
}: Props) {
  const ranked = [...players].sort((a, b) => b.score - a.score);

  return (
    <div style={{ overflow: 'auto', minHeight: 0 }}>
      <PlayerRows list={ranked} hostId={hostId} isHost={isHost} onKick={onKick} />

      {spectators.length > 0 && (
        <>
          <h3 className="side-title" style={{ marginTop: '0.85rem' }}>
            Spectators
          </h3>
          <PlayerRows list={spectators} hostId={hostId} isHost={isHost} onKick={onKick} />
        </>
      )}

      {showTopGuessers && topGuessers.length > 0 && (
        <>
          <h3 className="side-title" style={{ marginTop: '0.85rem' }}>
            Top Guessers
          </h3>
          {topGuessers.map((g) => (
            <div className="player-row" key={g.playerId}>
              <div className="name">
                #{g.placement} {g.playerName}
              </div>
              <span className="status-chip guessed">Guessed</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
