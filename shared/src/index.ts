export type PlayerRole = 'drawer' | 'guesser' | 'spectator';
export type PlayerStatus = 'drawing' | 'guessed' | 'guessing' | 'spectating' | 'lobby';
export type GamePhase = 'lobby' | 'playing' | 'roundResults' | 'finalScoreboard';

export interface RoomSettings {
  roundDurationSec: number;
  totalRounds: number;
  maxPlayers: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  roundDurationSec: 180,
  totalRounds: 3,
  maxPlayers: 8,
};

export interface PlayerPublic {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  role: PlayerRole;
  status: PlayerStatus;
  guessPlacement: number | null;
  connected: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'chat' | 'system' | 'guess';
  playerId?: string;
  playerName?: string;
  text: string;
  at: number;
}

export interface RoundResultEntry {
  playerId: string;
  playerName: string;
  placement: number | null;
  pointsAwarded: number;
  isDrawer: boolean;
}

export interface RoomPublicState {
  code: string;
  phase: GamePhase;
  settings: RoomSettings;
  hostId: string;
  players: PlayerPublic[];
  spectators: PlayerPublic[];
  chat: ChatMessage[];
  currentRound: number;
  drawerId: string | null;
  roundEndsAt: number | null;
  wordLength: number | null;
  wordHint: string | null;
  revealedWord: string | null;
  topGuessers: Array<{ playerId: string; playerName: string; placement: number }>;
  roundResults: RoundResultEntry[] | null;
  finalScores: Array<{ playerId: string; playerName: string; score: number }> | null;
  canJoinAsPlayer: boolean;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface StrokeStyle {
  color: string;
  size: number;
  tool: 'brush' | 'eraser';
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  style: StrokeStyle;
}

export type Ack<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type ClientToServerEvents = {
  'room:create': (
    payload: { name: string; settings?: Partial<RoomSettings> },
    ack: (res: Ack<{ playerId: string; state: RoomPublicState }>) => void,
  ) => void;
  'room:join': (
    payload: { code: string; name: string; asSpectator?: boolean },
    ack: (res: Ack<{ playerId: string; state: RoomPublicState }>) => void,
  ) => void;
  'room:reconnect': (
    payload: { code: string; playerId: string },
    ack: (res: Ack<{ state: RoomPublicState; secretWord?: string }>) => void,
  ) => void;
  'room:updateSettings': (
    payload: Partial<RoomSettings>,
    ack: (res: Ack) => void,
  ) => void;
  'room:kick': (
    payload: { playerId: string },
    ack: (res: Ack) => void,
  ) => void;
  'room:start': (ack: (res: Ack) => void) => void;
  'room:end': (ack: (res: Ack) => void) => void;
  'room:promoteSpectator': (ack: (res: Ack) => void) => void;
  'chat:send': (
    payload: { text: string },
    ack: (res: Ack) => void,
  ) => void;
  'game:guess': (
    payload: { text: string },
    ack: (res: Ack<{ correct: boolean }>) => void,
  ) => void;
  'draw:strokeStart': (payload: { stroke: Stroke }) => void;
  'draw:strokePoint': (payload: { strokeId: string; point: StrokePoint }) => void;
  'draw:strokeEnd': (payload: { strokeId: string }) => void;
  'draw:undo': () => void;
  'draw:clear': () => void;
};

export type ServerToClientEvents = {
  'room:state': (state: RoomPublicState) => void;
  'game:secretWord': (payload: { word: string }) => void;
  'draw:strokeStart': (payload: { stroke: Stroke }) => void;
  'draw:strokePoint': (payload: { strokeId: string; point: StrokePoint }) => void;
  'draw:strokeEnd': (payload: { strokeId: string }) => void;
  'draw:undo': () => void;
  'draw:clear': () => void;
  'draw:sync': (payload: { strokes: Stroke[] }) => void;
  'chat:message': (message: ChatMessage) => void;
  'error:toast': (payload: { message: string }) => void;
};

export const WORD_BANK = [
  'astronaut', 'banana', 'bicycle', 'cactus', 'camera', 'castle', 'catapult',
  'chameleon', 'compass', 'dinosaur', 'dolphin', 'dragon', 'earbuds', 'eclipse',
  'elephant', 'firefly', 'flamingo', 'galaxy', 'giraffe', 'guitar', 'hamburger',
  'helicopter', 'iceberg', 'jellyfish', 'kangaroo', 'lighthouse', 'meteor',
  'microphone', 'mushroom', 'octopus', 'origami', 'penguin', 'pizza', 'pyramid',
  'rainbow', 'robot', 'rocket', 'saxophone', 'scuba', 'seahorse', 'skateboard',
  'spaceship', 'submarine', 'suitcase', 'sunglasses', 'surfboard', 'telescope',
  'tornado', 'trampoline', 'umbrella', 'unicorn', 'vampire', 'volcano', 'waffle',
  'waterfall', 'whale', 'wizard', 'zeppelin', 'zipper', 'zombie',
] as const;
