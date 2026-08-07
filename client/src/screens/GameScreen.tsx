import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameApi } from '../hooks/useGame';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { ChatPanel } from '../components/ChatPanel';
import { Leaderboard } from '../components/Leaderboard';
import { WrongGuessMeme } from '../components/WrongGuessMeme';
import { pickRandomFaahMeme, playFaah, preloadFaahAssets } from '../lib/faah';
import { ResultsOverlay, useCountdown } from './ResultsOverlay';

type Props = { game: GameApi };

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type FaahState = {
  memeSrc: string;
} | null;

export function GameScreen({ game }: Props) {
  const { state, secretWord, me, playerId, canDraw, canGuess } = game;
  const secondsLeft = useCountdown(state?.roundEndsAt ?? null);
  const [faah, setFaah] = useState<FaahState>(null);
  const lastMemeRef = useRef<string | null>(null);
  const faahTokenRef = useRef(0);

  useEffect(() => {
    preloadFaahAssets();
  }, []);

  const onGuess = useCallback(
    (text: string, done?: (result: { wrong: boolean }) => void) => {
      game.sendGuess(text, (result) => {
        if (result.wrong) {
          const memeSrc = pickRandomFaahMeme(lastMemeRef.current);
          lastMemeRef.current = memeSrc;
          const token = ++faahTokenRef.current;
          setFaah({ memeSrc });
          void playFaah().then(() => {
            // Clear only if this is still the active FAAHH reaction
            if (faahTokenRef.current === token) setFaah(null);
          });
        }
        done?.(result);
      });
    },
    [game],
  );

  const clearFaah = useCallback(() => setFaah(null), []);

  if (!state) return null;

  const isHost = playerId === state.hostId;
  const wordLabel = canDraw
    ? (secretWord ?? state.wordHint)
    : (state.wordHint ?? (state.wordLength != null ? '_ '.repeat(state.wordLength).trim() : '—'));

  let lockedReason: string | null = null;
  if (state.phase !== 'playing') {
    lockedReason = 'Wait for the next round';
  } else if (me?.role === 'spectator') {
    lockedReason = 'Spectators cannot guess';
  } else if (canDraw) {
    lockedReason = 'You are drawing — no spoilers';
  } else if (me?.guessPlacement != null) {
    lockedReason = 'Already guessed!';
  }

  return (
    <div className="game-layout">
      <div className="game-top">
        <div className="round-meta">
          <div>
            <div className="pixel-label">Round</div>
            <strong style={{ color: 'var(--cyan)' }}>
              {state.currentRound}/{state.settings.totalRounds}
            </strong>
          </div>
          <div>
            <div className="pixel-label">Time</div>
            <div className="timer" style={{ color: secondsLeft <= 10 ? 'var(--danger)' : undefined }}>
              {formatTime(secondsLeft)}
            </div>
          </div>
          <div>
            <div className="pixel-label">{canDraw ? 'Your word' : 'Hint'}</div>
            <div className="word-slot">{wordLabel ?? '—'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {me?.role === 'spectator' && state.canJoinAsPlayer && (
            <button type="button" className="menu-btn" style={{ width: 'auto', margin: 0 }} onClick={game.promoteSpectator}>
              Join as player
            </button>
          )}
          {isHost && (
            <button type="button" className="menu-btn danger" style={{ width: 'auto', margin: 0 }} onClick={game.endGame}>
              End game
            </button>
          )}
        </div>
      </div>

      <div className="side-panel leaderboard">
        <h2 className="side-title">Leaderboard</h2>
        <Leaderboard
          players={state.players}
          spectators={state.spectators}
          topGuessers={state.topGuessers}
          hostId={state.hostId}
          isHost={isHost}
          onKick={isHost ? game.kickPlayer : undefined}
        />
      </div>

      <div className="canvas-panel">
        <DrawingCanvas
          strokes={game.strokes}
          canDraw={canDraw}
          onStrokeStart={game.strokeStart}
          onStrokePoint={game.strokePoint}
          onStrokeEnd={game.strokeEnd}
          onUndo={game.undo}
          onClear={game.clearCanvas}
        />
      </div>

      <div className="side-panel chat">
        <h2 className="side-title">Chat / Guesses</h2>
        <ChatPanel
          messages={state.chat}
          canGuess={canGuess}
          onGuess={onGuess}
          onChat={game.sendChat}
          lockedReason={lockedReason}
        />
      </div>

      <WrongGuessMeme
        show={faah != null}
        memeSrc={faah?.memeSrc ?? null}
        onDone={clearFaah}
      />
      <ResultsOverlay game={game} />
    </div>
  );
}
