import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ChatMessage,
  RoomPublicState,
  RoomSettings,
  Stroke,
  StrokePoint,
} from '@it-is-what-is-it/shared';
import { getSocket } from '../lib/socket';

const SESSION_KEY = 'it-is-what-is-it.session';

interface Session {
  code: string;
  playerId: string;
  name: string;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function useGame() {
  const socket = useMemo(() => getSocket(), []);
  const [screen, setScreen] = useState<'home' | 'room'>('home');
  const [state, setState] = useState<RoomPublicState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [secretWord, setSecretWord] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      const sess = loadSession();
      if (!sess) return;
      socket.emit('room:reconnect', { code: sess.code, playerId: sess.playerId }, (res) => {
        if (!res.ok) {
          saveSession(null);
          setScreen('home');
          setState(null);
          return;
        }
        setPlayerId(sess.playerId);
        setState(res.state);
        setScreen('room');
        if (res.secretWord) setSecretWord(res.secretWord);
      });
    };
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', (next) => {
      setState(next);
      setScreen('room');
      if (next.phase !== 'playing') setSecretWord(next.revealedWord);
    });
    socket.on('game:secretWord', ({ word }) => setSecretWord(word));
    socket.on('chat:message', (message: ChatMessage) => {
      setState((prev) =>
        prev ? { ...prev, chat: [...prev.chat, message].slice(-80) } : prev,
      );
    });
    socket.on('draw:strokeStart', ({ stroke }) => {
      setStrokes((prev) => [...prev, stroke]);
    });
    socket.on('draw:strokePoint', ({ strokeId, point }) => {
      setStrokes((prev) =>
        prev.map((s) =>
          s.id === strokeId ? { ...s, points: [...s.points, point] } : s,
        ),
      );
    });
    socket.on('draw:undo', () => setStrokes((prev) => prev.slice(0, -1)));
    socket.on('draw:clear', () => setStrokes([]));
    socket.on('draw:sync', ({ strokes: next }) => setStrokes(next));
    socket.on('error:toast', ({ message }) => {
      setToast(message);
      setTimeout(() => setToast(null), 3500);
    });

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.removeAllListeners('room:state');
      socket.removeAllListeners('game:secretWord');
      socket.removeAllListeners('chat:message');
      socket.removeAllListeners('draw:strokeStart');
      socket.removeAllListeners('draw:strokePoint');
      socket.removeAllListeners('draw:undo');
      socket.removeAllListeners('draw:clear');
      socket.removeAllListeners('draw:sync');
      socket.removeAllListeners('error:toast');
    };
  }, [socket]);

  const createRoom = useCallback(
    (name: string, settings?: Partial<RoomSettings>, vsBot = false) => {
      setError(null);
      socket.emit('room:create', { name, settings, vsBot }, (res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const sess = { code: res.state.code, playerId: res.playerId, name };
        saveSession(sess);
        setPlayerId(res.playerId);
        setState(res.state);
        setScreen('room');
        setStrokes(res.state.phase === 'playing' ? [] : []);
      });
    },
    [socket],
  );

  const joinRoom = useCallback(
    (code: string, name: string, asSpectator = false) => {
      setError(null);
      socket.emit('room:join', { code, name, asSpectator }, (res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const sess = { code: code.toUpperCase(), playerId: res.playerId, name };
        saveSession(sess);
        setPlayerId(res.playerId);
        setState(res.state);
        setScreen('room');
      });
    },
    [socket],
  );

  const updateSettings = useCallback(
    (settings: Partial<RoomSettings>) => {
      socket.emit('room:updateSettings', settings, (res) => {
        if (!res.ok) setToast(res.error);
      });
    },
    [socket],
  );

  const startGame = useCallback(() => {
    socket.emit('room:start', (res) => {
      if (!res.ok) setToast(res.error);
    });
  }, [socket]);

  const endGame = useCallback(() => {
    socket.emit('room:end', (res) => {
      if (!res.ok) setToast(res.error);
    });
  }, [socket]);

  const kickPlayer = useCallback(
    (id: string) => {
      socket.emit('room:kick', { playerId: id }, (res) => {
        if (!res.ok) setToast(res.error);
      });
    },
    [socket],
  );

  const promoteSpectator = useCallback(() => {
    socket.emit('room:promoteSpectator', (res) => {
      if (!res.ok) setToast(res.error);
    });
  }, [socket]);

  const sendGuess = useCallback(
    (text: string, done?: (correct: boolean) => void) => {
      socket.emit('game:guess', { text }, (res) => {
        if (!res.ok) {
          setToast(res.error);
          done?.(false);
          return;
        }
        done?.(res.correct);
      });
    },
    [socket],
  );

  const sendChat = useCallback(
    (text: string) => {
      socket.emit('chat:send', { text }, (res) => {
        if (!res.ok) setToast(res.error);
      });
    },
    [socket],
  );

  const leaveToHome = useCallback(() => {
    saveSession(null);
    setScreen('home');
    setState(null);
    setPlayerId(null);
    setSecretWord(null);
    setStrokes([]);
    socket.disconnect();
    socket.connect();
  }, [socket]);

  const strokeStart = useCallback(
    (stroke: Stroke) => {
      setStrokes((prev) => [...prev, stroke]);
      socket.emit('draw:strokeStart', { stroke });
    },
    [socket],
  );

  const strokePoint = useCallback(
    (strokeId: string, point: StrokePoint) => {
      setStrokes((prev) =>
        prev.map((s) =>
          s.id === strokeId ? { ...s, points: [...s.points, point] } : s,
        ),
      );
      socket.emit('draw:strokePoint', { strokeId, point });
    },
    [socket],
  );

  const strokeEnd = useCallback(
    (strokeId: string) => {
      socket.emit('draw:strokeEnd', { strokeId });
    },
    [socket],
  );

  const undo = useCallback(() => socket.emit('draw:undo'), [socket]);
  const clearCanvas = useCallback(() => socket.emit('draw:clear'), [socket]);

  const me = state?.players.find((p) => p.id === playerId)
    ?? state?.spectators.find((p) => p.id === playerId)
    ?? null;

  const canDraw = state?.phase === 'playing' && state.drawerId === playerId;
  const canGuess =
    !!state &&
    state.phase === 'playing' &&
    !!playerId &&
    playerId !== state.drawerId &&
    !!me &&
    me.role !== 'spectator' &&
    me.guessPlacement == null;

  return {
    screen,
    state,
    playerId,
    secretWord,
    strokes,
    toast,
    connected,
    error,
    setError,
    me,
    canDraw,
    canGuess,
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    endGame,
    kickPlayer,
    promoteSpectator,
    sendGuess,
    sendChat,
    leaveToHome,
    strokeStart,
    strokePoint,
    strokeEnd,
    undo,
    clearCanvas,
  };
}

export type GameApi = ReturnType<typeof useGame>;
