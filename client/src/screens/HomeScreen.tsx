import { useState, type FormEvent } from 'react';
import { DEFAULT_SETTINGS, type RoomSettings } from '@it-is-what-is-it/shared';
import type { GameApi } from '../hooks/useGame';

type Props = { game: GameApi };

export function HomeScreen({ game }: Props) {
  const [name, setName] = useState(() => localStorage.getItem('it-is-what-is-it.name') ?? '');
  const [code, setCode] = useState('');
  const [showHowTo, setShowHowTo] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_SETTINGS });

  const persistName = (value: string) => {
    setName(value);
    localStorage.setItem('it-is-what-is-it.name', value);
  };

  const requireName = () => {
    if (!name.trim()) {
      game.setError('Enter a player name');
      return false;
    }
    return true;
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!requireName()) return;
    game.createRoom(name.trim(), settings);
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!requireName()) return;
    if (!code.trim()) {
      game.setError('Enter a room code');
      return;
    }
    game.joinRoom(code.trim(), name.trim(), false);
  };

  const onSpectate = () => {
    if (!requireName()) return;
    if (!code.trim()) {
      game.setError('Enter a room code');
      return;
    }
    game.joinRoom(code.trim(), name.trim(), true);
  };

  return (
    <div className="menu-overlay">
      <div className="menu-card">
        <h1 className="brand">It is what is it?</h1>
        <p className="tagline">Draw it. Guess it. Neon glory.</p>

        <label className="menu-field">
          Player name
          <input
            value={name}
            maxLength={16}
            onChange={(e) => persistName(e.target.value)}
            placeholder="Arcade alias"
            autoFocus
          />
        </label>

        <div className="settings-row">
          <label className="menu-field">
            Round sec
            <input
              type="number"
              min={30}
              max={300}
              value={settings.roundDurationSec}
              onChange={(e) =>
                setSettings((s) => ({ ...s, roundDurationSec: Number(e.target.value) || s.roundDurationSec }))
              }
            />
          </label>
          <label className="menu-field">
            Rounds
            <input
              type="number"
              min={1}
              max={20}
              value={settings.totalRounds}
              onChange={(e) =>
                setSettings((s) => ({ ...s, totalRounds: Number(e.target.value) || s.totalRounds }))
              }
            />
          </label>
          <label className="menu-field">
            Max players
            <input
              type="number"
              min={2}
              max={16}
              value={settings.maxPlayers}
              onChange={(e) =>
                setSettings((s) => ({ ...s, maxPlayers: Number(e.target.value) || s.maxPlayers }))
              }
            />
          </label>
        </div>

        <form onSubmit={onCreate}>
          <button className="menu-btn primary" type="submit" disabled={!game.connected}>
            Create private room
          </button>
        </form>

        <div className="menu-divider">or enter a code</div>

        <form onSubmit={onJoin}>
          <label className="menu-field">
            Room code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A1B2"
              maxLength={6}
            />
          </label>
          <button className="menu-btn" type="submit" disabled={!game.connected}>
            Enter room
          </button>
        </form>

        <button type="button" className="menu-btn" disabled={!game.connected} onClick={onSpectate}>
          Join as spectator
        </button>

        <button type="button" className="menu-btn" onClick={() => setShowHowTo((v) => !v)}>
          {showHowTo ? 'Hide how to play' : 'Show how to play'}
        </button>

        {showHowTo && (
          <div className="howto">
            <ol>
              <li>One player is randomly chosen as the drawer.</li>
              <li>Only the drawer sees the secret word.</li>
              <li>Guessers type answers in chat — correct guesses stay secret.</li>
              <li>Score by guess order; drawer gets a bonus for successful reveals.</li>
              <li>Spectators watch live and can jump in when a slot opens.</li>
            </ol>
          </div>
        )}

        {(game.error || !game.connected) && (
          <div className="menu-error">{game.error ?? 'Connecting to server…'}</div>
        )}
      </div>
    </div>
  );
}
