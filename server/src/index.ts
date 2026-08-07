import express from 'express';
import { createServer } from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import { randomUUID } from 'node:crypto';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Stroke,
} from '@it-is-what-is-it/shared';
import {
  canJoinAsPlayer,
  chooseNextDrawer,
  clearBotTimers,
  createRoom,
  drawerBonus,
  getPublicState,
  guesserPoints,
  normalizeGuess,
  pickWord,
  pushSystem,
  type InternalPlayer,
  type Room,
} from './room.js';
import { startBotDrawing } from './bot.js';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? true;
const rooms = new Map<string, Room>();
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/health', (_req, res) => {
  res.json({ ok: true, name: 'it-is-what-is-it' });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

function broadcastState(room: Room) {
  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    io.to(player.socketId).emit('room:state', getPublicState(room, player.id));
  }
}

function clearTimers(room: Room) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
  if (room.resultsTimer) {
    clearTimeout(room.resultsTimer);
    room.resultsTimer = null;
  }
  clearBotTimers(room);
}

function resetRoundFlags(room: Room) {
  for (const p of room.players.values()) {
    p.guessPlacement = null;
    p.roundPoints = 0;
    if (p.isSpectator) {
      p.role = 'spectator';
      p.status = 'spectating';
    } else {
      p.role = 'guesser';
      p.status = 'guessing';
    }
  }
}

function startRound(room: Room) {
  clearTimers(room);
  room.strokes = [];
  room.currentRound += 1;
  resetRoundFlags(room);

  const drawer = chooseNextDrawer(room);
  if (!drawer) {
    pushSystem(room, 'Not enough players to continue.');
    room.phase = 'lobby';
    broadcastState(room);
    return;
  }

  const word = pickWord(room.usedWords);
  room.usedWords.add(word);
  room.secretWord = word;
  room.drawerId = drawer.id;
  room.phase = 'playing';
  room.roundEndsAt = Date.now() + room.settings.roundDurationSec * 1000;

  drawer.role = 'drawer';
  drawer.status = 'drawing';

  pushSystem(room, `Round ${room.currentRound}: ${drawer.name} is drawing!`);
  broadcastState(room);
  io.to(room.code).emit('draw:clear');

  if (drawer.socketId) {
    io.to(drawer.socketId).emit('game:secretWord', { word });
    io.to(drawer.socketId).emit('draw:sync', { strokes: [] });
  }

  if (drawer.isBot) {
    startBotDrawing(room, word, {
      strokeStart: (stroke) => io.to(room.code).emit('draw:strokeStart', { stroke }),
      strokePoint: (strokeId, point) => io.to(room.code).emit('draw:strokePoint', { strokeId, point }),
      strokeEnd: (strokeId) => io.to(room.code).emit('draw:strokeEnd', { strokeId }),
    });
  }

  room.roundTimer = setTimeout(() => endRound(room), room.settings.roundDurationSec * 1000);
}

function endRound(room: Room) {
  if (room.phase !== 'playing') return;
  clearTimers(room);

  const guessers = [...room.players.values()].filter((p) => !p.isSpectator && p.id !== room.drawerId);
  const correctCount = guessers.filter((p) => p.guessPlacement != null).length;
  const drawer = room.drawerId ? room.players.get(room.drawerId) : undefined;
  if (drawer) {
    const bonus = drawerBonus(correctCount, guessers.length);
    drawer.roundPoints = bonus;
    drawer.score += bonus;
  }

  pushSystem(room, `Time's up! The word was "${room.secretWord}".`);
  room.phase = 'roundResults';
  room.roundEndsAt = null;
  broadcastState(room);

  room.resultsTimer = setTimeout(() => {
    if (room.currentRound >= room.settings.totalRounds) {
      room.phase = 'finalScoreboard';
      pushSystem(room, 'Game over — final scores!');
      broadcastState(room);
      return;
    }
    startRound(room);
  }, 6000);
}

function ensureUniqueName(room: Room, desired: string): string {
  const base = desired.trim().slice(0, 16) || 'Player';
  const names = new Set([...room.players.values()].map((p) => p.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let i = 2;
  while (names.has(`${base}${i}`.toLowerCase())) i += 1;
  return `${base}${i}`;
}

function bindSocket(socketId: string, roomCode: string, playerId: string) {
  socketToPlayer.set(socketId, { roomCode, playerId });
}

io.on('connection', (socket) => {
  socket.on('room:create', (payload, ack) => {
    const name = payload?.name?.trim();
    if (!name) return ack({ ok: false, error: 'Enter a name' });

    const vsBot = Boolean(payload.vsBot);
    let created = createRoom(name, payload.settings, vsBot);
    while (rooms.has(created.room.code)) {
      created = createRoom(name, payload.settings, vsBot);
    }
    const { room, host } = created;
    host.socketId = socket.id;
    rooms.set(room.code, room);
    socket.join(room.code);
    bindSocket(socket.id, room.code, host.id);
    pushSystem(
      room,
      vsBot
        ? `${host.name} started a vs bot match. SketchBot will draw — you guess!`
        : `${host.name} created the room.`,
    );

    if (vsBot) {
      room.currentRound = 0;
      room.drawerHistory = [];
      room.usedWords = new Set();
      startRound(room);
    }

    ack({ ok: true, playerId: host.id, state: getPublicState(room, host.id) });
  });

  socket.on('room:join', (payload, ack) => {
    const room = getRoom(payload?.code ?? '');
    if (!room) return ack({ ok: false, error: 'Room not found' });
    const name = ensureUniqueName(room, payload?.name ?? '');
    if (!name) return ack({ ok: false, error: 'Enter a name' });

    const asSpectator =
      Boolean(payload.asSpectator) || !canJoinAsPlayer(room) || room.phase !== 'lobby';
    const player: InternalPlayer = {
      id: randomUUID(),
      name,
      score: 0,
      isHost: false,
      role: asSpectator ? 'spectator' : 'guesser',
      status: asSpectator ? 'spectating' : room.phase === 'lobby' ? 'lobby' : 'guessing',
      guessPlacement: null,
      connected: true,
      socketId: socket.id,
      isSpectator: asSpectator,
      roundPoints: 0,
      isBot: false,
    };

    room.players.set(player.id, player);
    socket.join(room.code);
    bindSocket(socket.id, room.code, player.id);
    pushSystem(room, asSpectator ? `${name} joined as spectator.` : `${name} joined the room.`);
    broadcastState(room);
    if (room.phase === 'playing') {
      socket.emit('draw:sync', { strokes: room.strokes });
    }
    ack({ ok: true, playerId: player.id, state: getPublicState(room, player.id) });
  });

  socket.on('room:reconnect', (payload, ack) => {
    const room = getRoom(payload?.code ?? '');
    if (!room) return ack({ ok: false, error: 'Room not found' });
    const player = room.players.get(payload.playerId);
    if (!player) return ack({ ok: false, error: 'Player not found' });

    player.connected = true;
    player.socketId = socket.id;
    socket.join(room.code);
    bindSocket(socket.id, room.code, player.id);
    broadcastState(room);
    if (room.phase === 'playing') {
      socket.emit('draw:sync', { strokes: room.strokes });
    }
    const secret =
      room.phase === 'playing' && player.id === room.drawerId && room.secretWord
        ? room.secretWord
        : undefined;
    ack({ ok: true, state: getPublicState(room, player.id), ...(secret ? { secretWord: secret } : {}) });
  });

  socket.on('room:updateSettings', (payload, ack) => {
    const ref = socketToPlayer.get(socket.id);
    if (!ref) return ack({ ok: false, error: 'Not in a room' });
    const room = getRoom(ref.roomCode);
    if (!room) return ack({ ok: false, error: 'Room not found' });
    if (ref.playerId !== room.hostId) return ack({ ok: false, error: 'Only the host can change settings' });
    if (room.phase !== 'lobby') return ack({ ok: false, error: 'Settings locked during a game' });

    room.settings = {
      ...room.settings,
      ...(payload.roundDurationSec != null
        ? { roundDurationSec: Math.min(300, Math.max(30, Math.round(payload.roundDurationSec))) }
        : {}),
      ...(payload.totalRounds != null
        ? { totalRounds: Math.min(10, Math.max(1, Math.round(payload.totalRounds))) }
        : {}),
      ...(payload.maxPlayers != null
        ? { maxPlayers: Math.min(16, Math.max(2, Math.round(payload.maxPlayers))) }
        : {}),
    };
    broadcastState(room);
    ack({ ok: true });
  });

  socket.on('room:kick', (payload, ack) => {
    const ref = socketToPlayer.get(socket.id);
    if (!ref) return ack({ ok: false, error: 'Not in a room' });
    const room = getRoom(ref.roomCode);
    if (!room) return ack({ ok: false, error: 'Room not found' });
    if (ref.playerId !== room.hostId) return ack({ ok: false, error: 'Only the host can kick' });
    if (payload.playerId === room.hostId) return ack({ ok: false, error: 'Cannot kick the host' });

    const target = room.players.get(payload.playerId);
    if (!target) return ack({ ok: false, error: 'Player not found' });
    if (target.isBot) return ack({ ok: false, error: 'Cannot kick the bot' });
    if (target.socketId) {
      io.to(target.socketId).emit('error:toast', { message: 'You were kicked from the room.' });
      io.sockets.sockets.get(target.socketId)?.leave(room.code);
      socketToPlayer.delete(target.socketId);
    }
    room.players.delete(payload.playerId);
    pushSystem(room, `${target.name} was kicked.`);
    broadcastState(room);
    ack({ ok: true });
  });

  socket.on('room:start', (ack) => {
    const ref = socketToPlayer.get(socket.id);
    if (!ref) return ack({ ok: false, error: 'Not in a room' });
    const room = getRoom(ref.roomCode);
    if (!room) return ack({ ok: false, error: 'Room not found' });
    if (ref.playerId !== room.hostId) return ack({ ok: false, error: 'Only the host can start' });
    if (room.phase !== 'lobby' && room.phase !== 'finalScoreboard') {
      return ack({ ok: false, error: 'Game already in progress' });
    }
    const count = [...room.players.values()].filter((p) => !p.isSpectator).length;
    if (count < 2) return ack({ ok: false, error: 'Need at least 2 players' });

    room.currentRound = 0;
    room.drawerHistory = [];
    room.usedWords = new Set();
    for (const p of room.players.values()) {
      if (!p.isSpectator) p.score = 0;
    }
    startRound(room);
    ack({ ok: true });
  });

  socket.on('room:end', (ack) => {
    const ref = socketToPlayer.get(socket.id);
    if (!ref) return ack({ ok: false, error: 'Not in a room' });
    const room = getRoom(ref.roomCode);
    if (!room) return ack({ ok: false, error: 'Room not found' });
    if (ref.playerId !== room.hostId) return ack({ ok: false, error: 'Only the host can end the game' });

    clearTimers(room);
    room.phase = 'lobby';
    room.drawerId = null;
    room.secretWord = null;
    room.roundEndsAt = null;
    room.strokes = [];
    room.currentRound = 0;
    for (const p of room.players.values()) {
      p.guessPlacement = null;
      p.roundPoints = 0;
      if (p.isSpectator) {
        p.role = 'spectator';
        p.status = 'spectating';
      } else {
        p.role = 'guesser';
        p.status = 'lobby';
      }
    }
    pushSystem(room, 'Host ended the game. Back to lobby.');
    broadcastState(room);
    ack({ ok: true });
  });

  socket.on('room:promoteSpectator', (ack) => {
    const ref = socketToPlayer.get(socket.id);
    if (!ref) return ack({ ok: false, error: 'Not in a room' });
    const room = getRoom(ref.roomCode);
    if (!room) return ack({ ok: false, error: 'Room not found' });
    const player = room.players.get(ref.playerId);
    if (!player?.isSpectator) return ack({ ok: false, error: 'Already a player' });
    if (!canJoinAsPlayer(room)) return ack({ ok: false, error: 'No player slots available' });

    player.isSpectator = false;
    player.role = room.phase === 'playing' && room.drawerId !== player.id ? 'guesser' : 'guesser';
    player.status =
      room.phase === 'lobby'
        ? 'lobby'
        : room.phase === 'playing'
          ? 'guessing'
          : 'lobby';
    pushSystem(room, `${player.name} joined as a player.`);
    broadcastState(room);
    ack({ ok: true });
  });

  socket.on('chat:send', (payload, ack) => {
    const ref = socketToPlayer.get(socket.id);
    if (!ref) return ack({ ok: false, error: 'Not in a room' });
    const room = getRoom(ref.roomCode);
    if (!room) return ack({ ok: false, error: 'Room not found' });
    const player = room.players.get(ref.playerId);
    if (!player) return ack({ ok: false, error: 'Player not found' });
    const text = (payload?.text ?? '').trim().slice(0, 120);
    if (!text) return ack({ ok: false, error: 'Empty message' });
    if (
      room.phase === 'playing' &&
      room.secretWord &&
      normalizeGuess(text) === normalizeGuess(room.secretWord)
    ) {
      return ack({ ok: false, error: 'Cannot reveal the word in chat' });
    }
    const message = {
      id: randomUUID(),
      type: 'chat' as const,
      playerId: player.id,
      playerName: player.name,
      text,
      at: Date.now(),
    };
    room.chat.push(message);
    io.to(room.code).emit('chat:message', message);
    ack({ ok: true });
  });

  socket.on('game:guess', (payload, ack) => {
    const ref = socketToPlayer.get(socket.id);
    if (!ref) return ack({ ok: false, error: 'Not in a room' });
    const room = getRoom(ref.roomCode);
    if (!room) return ack({ ok: false, error: 'Room not found' });
    const player = room.players.get(ref.playerId);
    if (!player) return ack({ ok: false, error: 'Player not found' });
    if (room.phase !== 'playing') return ack({ ok: false, error: 'No active round' });
    if (player.isSpectator) return ack({ ok: false, error: 'Spectators cannot guess' });
    if (player.id === room.drawerId) return ack({ ok: false, error: 'Drawer cannot guess' });
    if (player.guessPlacement != null) return ack({ ok: false, error: 'Already guessed correctly' });

    const text = (payload.text ?? '').trim().slice(0, 80);
    if (!text) return ack({ ok: false, error: 'Empty guess' });

    const correct = normalizeGuess(text) === normalizeGuess(room.secretWord ?? '');
    if (correct) {
      const placement =
        [...room.players.values()].filter((p) => p.guessPlacement != null).length + 1;
      const points = guesserPoints(placement);
      player.guessPlacement = placement;
      player.status = 'guessed';
      player.roundPoints = points;
      player.score += points;

      const msg = pushSystem(room, `${player.name} guessed the word!`);
      io.to(room.code).emit('chat:message', msg);
      broadcastState(room);

      const guessers = [...room.players.values()].filter(
        (p) => !p.isSpectator && p.id !== room.drawerId && p.connected,
      );
      if (guessers.every((p) => p.guessPlacement != null)) {
        endRound(room);
      }
      return ack({ ok: true, correct: true });
    }

    const guessMsg = {
      id: randomUUID(),
      type: 'guess' as const,
      playerId: player.id,
      playerName: player.name,
      text,
      at: Date.now(),
    };
    room.chat.push(guessMsg);
    io.to(room.code).emit('chat:message', guessMsg);
    ack({ ok: true, correct: false });
  });

  const isDrawer = () => {
    const ref = socketToPlayer.get(socket.id);
    if (!ref) return null;
    const room = getRoom(ref.roomCode);
    if (!room || room.phase !== 'playing' || room.drawerId !== ref.playerId) return null;
    return room;
  };

  socket.on('draw:strokeStart', ({ stroke }) => {
    const room = isDrawer();
    if (!room || !stroke?.id) return;
    const clean: Stroke = {
      id: stroke.id,
      points: stroke.points?.slice(0, 1) ?? [],
      style: {
        color: stroke.style?.color ?? '#ff2bd6',
        size: Math.min(48, Math.max(1, stroke.style?.size ?? 6)),
        tool: stroke.style?.tool === 'eraser' ? 'eraser' : 'brush',
      },
    };
    room.strokes.push(clean);
    socket.to(room.code).emit('draw:strokeStart', { stroke: clean });
  });

  socket.on('draw:strokePoint', ({ strokeId, point }) => {
    const room = isDrawer();
    if (!room || !strokeId || !point) return;
    const stroke = room.strokes.find((s) => s.id === strokeId);
    if (!stroke) return;
    stroke.points.push(point);
    socket.to(room.code).emit('draw:strokePoint', { strokeId, point });
  });

  socket.on('draw:strokeEnd', ({ strokeId }) => {
    const room = isDrawer();
    if (!room || !strokeId) return;
    socket.to(room.code).emit('draw:strokeEnd', { strokeId });
  });

  socket.on('draw:undo', () => {
    const room = isDrawer();
    if (!room) return;
    room.strokes.pop();
    io.to(room.code).emit('draw:undo');
  });

  socket.on('draw:clear', () => {
    const room = isDrawer();
    if (!room) return;
    room.strokes = [];
    io.to(room.code).emit('draw:clear');
  });

  socket.on('disconnect', () => {
    const ref = socketToPlayer.get(socket.id);
    if (!ref) return;
    socketToPlayer.delete(socket.id);
    const room = getRoom(ref.roomCode);
    if (!room) return;
    const player = room.players.get(ref.playerId);
    if (!player) return;
    player.connected = false;
    player.socketId = null;
    pushSystem(room, `${player.name} disconnected.`);
    broadcastState(room);

    const anyoneLeft = [...room.players.values()].some((p) => p.connected);
    if (!anyoneLeft) {
      clearTimers(room);
      rooms.delete(room.code);
    } else if (player.isHost) {
      const nextHost = [...room.players.values()].find((p) => p.connected && p.id !== player.id);
      if (nextHost) {
        player.isHost = false;
        nextHost.isHost = true;
        room.hostId = nextHost.id;
        pushSystem(room, `${nextHost.name} is the new host.`);
        broadcastState(room);
      }
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`It is what is it? server listening on :${PORT}`);
});
