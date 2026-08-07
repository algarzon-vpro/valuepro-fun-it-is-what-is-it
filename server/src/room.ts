import {
  DEFAULT_SETTINGS,
  type ChatMessage,
  type GamePhase,
  type PlayerPublic,
  type PlayerRole,
  type PlayerStatus,
  type RoomPublicState,
  type RoomSettings,
  type RoundResultEntry,
  type Stroke,
  WORD_BANK,
} from '@it-is-what-is-it/shared';
import { randomUUID } from 'node:crypto';

export interface InternalPlayer {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  role: PlayerRole;
  status: PlayerStatus;
  guessPlacement: number | null;
  connected: boolean;
  socketId: string | null;
  isSpectator: boolean;
  roundPoints: number;
}

export interface Room {
  code: string;
  settings: RoomSettings;
  hostId: string;
  phase: GamePhase;
  players: Map<string, InternalPlayer>;
  chat: ChatMessage[];
  currentRound: number;
  drawerId: string | null;
  roundEndsAt: number | null;
  secretWord: string | null;
  strokes: Stroke[];
  drawerHistory: string[];
  roundTimer: NodeJS.Timeout | null;
  resultsTimer: NodeJS.Timeout | null;
  usedWords: Set<string>;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]!;
  }
  return code;
}

export function normalizeGuess(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

export function pickWord(used: Set<string>): string {
  const available = WORD_BANK.filter((w) => !used.has(w));
  const pool = available.length > 0 ? available : [...WORD_BANK];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function createRoom(
  hostName: string,
  settings?: Partial<RoomSettings>,
): { room: Room; host: InternalPlayer } {
  const hostId = randomUUID();
  const host: InternalPlayer = {
    id: hostId,
    name: hostName.trim().slice(0, 16) || 'Host',
    score: 0,
    isHost: true,
    role: 'guesser',
    status: 'lobby',
    guessPlacement: null,
    connected: true,
    socketId: null,
    isSpectator: false,
    roundPoints: 0,
  };

  const room: Room = {
    code: generateRoomCode(),
    settings: { ...DEFAULT_SETTINGS, ...settings },
    hostId,
    phase: 'lobby',
    players: new Map([[hostId, host]]),
    chat: [],
    currentRound: 0,
    drawerId: null,
    roundEndsAt: null,
    secretWord: null,
    strokes: [],
    drawerHistory: [],
    roundTimer: null,
    resultsTimer: null,
    usedWords: new Set(),
  };

  return { room, host };
}

function activePlayers(room: Room): InternalPlayer[] {
  return [...room.players.values()].filter((p) => !p.isSpectator);
}

export function canJoinAsPlayer(room: Room): boolean {
  return activePlayers(room).length < room.settings.maxPlayers;
}

function toPublicPlayer(p: InternalPlayer): PlayerPublic {
  return {
    id: p.id,
    name: p.name,
    score: p.score,
    isHost: p.isHost,
    role: p.role,
    status: p.status,
    guessPlacement: p.guessPlacement,
    connected: p.connected,
  };
}

export function getPublicState(room: Room, _viewerId?: string): RoomPublicState {
  const players = activePlayers(room).map(toPublicPlayer);
  const spectators = [...room.players.values()].filter((p) => p.isSpectator).map(toPublicPlayer);
  const topGuessers = activePlayers(room)
    .filter((p) => p.guessPlacement != null)
    .sort((a, b) => (a.guessPlacement ?? 99) - (b.guessPlacement ?? 99))
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      placement: p.guessPlacement as number,
    }));

  const word = room.secretWord;

  return {
    code: room.code,
    phase: room.phase,
    settings: room.settings,
    hostId: room.hostId,
    players,
    spectators,
    chat: room.chat.slice(-80),
    currentRound: room.currentRound,
    drawerId: room.drawerId,
    roundEndsAt: room.roundEndsAt,
    wordLength: word ? word.length : null,
    wordHint: room.phase === 'playing' && word ? '_ '.repeat(word.length).trim() : null,
    revealedWord:
      (room.phase === 'roundResults' || room.phase === 'finalScoreboard') && word ? word : null,
    topGuessers,
    roundResults: room.phase === 'roundResults' ? buildRoundResults(room) : null,
    finalScores:
      room.phase === 'finalScoreboard'
        ? activePlayers(room)
            .sort((a, b) => b.score - a.score)
            .map((p) => ({ playerId: p.id, playerName: p.name, score: p.score }))
        : null,
    canJoinAsPlayer: canJoinAsPlayer(room),
  };
}

export function pushSystem(room: Room, text: string): ChatMessage {
  const message: ChatMessage = {
    id: randomUUID(),
    type: 'system',
    text,
    at: Date.now(),
  };
  room.chat.push(message);
  return message;
}

export function chooseNextDrawer(room: Room): InternalPlayer | null {
  const roster = activePlayers(room).filter((p) => p.connected);
  if (roster.length === 0) return null;

  const remaining = roster.filter((p) => !room.drawerHistory.includes(p.id));
  const pool = remaining.length > 0 ? remaining : roster;
  if (remaining.length === 0) room.drawerHistory = [];

  const drawer = pool[Math.floor(Math.random() * pool.length)]!;
  room.drawerHistory.push(drawer.id);
  return drawer;
}

export function guesserPoints(placement: number): number {
  const table = [500, 400, 300, 250, 200, 150, 100, 50];
  return table[Math.min(placement - 1, table.length - 1)] ?? 50;
}

export function drawerBonus(correctCount: number, guesserCount: number): number {
  if (guesserCount <= 0 || correctCount <= 0) return 0;
  const ratio = correctCount / guesserCount;
  return Math.round(100 + ratio * 300);
}

export function buildRoundResults(room: Room): RoundResultEntry[] {
  return activePlayers(room)
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      placement: p.guessPlacement,
      pointsAwarded: p.roundPoints,
      isDrawer: p.id === room.drawerId,
    }))
    .sort((a, b) => b.pointsAwarded - a.pointsAwarded);
}
