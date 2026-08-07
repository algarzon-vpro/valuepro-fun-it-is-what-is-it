import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@it-is-what-is-it/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? '/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}
