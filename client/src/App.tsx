import { useGame } from './hooks/useGame';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';

export default function App() {
  const game = useGame();

  return (
    <div className="app-shell">
      <div className="crt-overlay" aria-hidden="true" />
      <div className="conn-pill" data-ok={game.connected ? '1' : '0'}>
        {game.connected ? 'Online' : 'Reconnecting'}
      </div>

      {game.screen === 'home' && <HomeScreen game={game} />}

      {game.screen === 'room' && game.state?.phase === 'lobby' && <LobbyScreen game={game} />}

      {game.screen === 'room' &&
        game.state &&
        game.state.phase !== 'lobby' && <GameScreen game={game} />}

      {game.toast && <div className="toast">{game.toast}</div>}
    </div>
  );
}
