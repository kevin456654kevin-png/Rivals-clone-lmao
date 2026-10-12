import Peer, { DataConnection } from 'peerjs';
import type { NetMessage, Role } from '../types';

type Listener = (msg: NetMessage) => void;

/**
 * Thin wrapper around PeerJS to manage a single 1v1 peer-to-peer connection.
 * Host creates a Peer with a short room code as its ID, client connects to that ID.
 */
export class Connection {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  role: Role = 'host';
  roomCode = '';
  private listeners: Listener[] = [];
  private openListeners: (() => void)[] = [];
  private closeListeners: (() => void)[] = [];
  private errorListeners: ((err: string) => void)[] = [];

  onMessage(cb: Listener) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  onOpen(cb: () => void) {
    this.openListeners.push(cb);
  }

  onClose(cb: () => void) {
    this.closeListeners.push(cb);
  }

  onError(cb: (err: string) => void) {
    this.errorListeners.push(cb);
  }

  private genCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  hostRoom(): Promise<string> {
    this.role = 'host';
    return new Promise((resolve, reject) => {
      const code = this.genCode();
      const peer = new Peer(`duelarena-${code}`, { debug: 1 });
      this.peer = peer;
      let settled = false;
      peer.on('open', (id) => {
        this.roomCode = code;
        settled = true;
        resolve(code);
        void id;
      });
      peer.on('connection', (conn) => {
        this.setupConn(conn);
      });
      peer.on('error', (err) => {
        this.errorListeners.forEach((l) => l(String(err.message || err)));
        if (!settled) reject(err);
      });
    });
  }

  joinRoom(code: string): Promise<void> {
    this.role = 'client';
    this.roomCode = code.trim().toUpperCase();
    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 1 });
      this.peer = peer;
      peer.on('open', () => {
        const conn = peer.connect(`duelarena-${this.roomCode}`, { reliable: true });
        let settled = false;
        conn.on('open', () => {
          settled = true;
          this.setupConn(conn);
          resolve();
        });
        conn.on('error', (err) => {
          if (!settled) reject(err);
        });
        setTimeout(() => {
          if (!settled) reject(new Error('Connection timed out. Check the room code.'));
        }, 12000);
      });
      peer.on('error', (err) => {
        this.errorListeners.forEach((l) => l(String(err.message || err)));
        reject(err);
      });
    });
  }

  private setupConn(conn: DataConnection) {
    this.conn = conn;
    conn.on('data', (data) => {
      this.listeners.forEach((l) => l(data as NetMessage));
    });
    conn.on('close', () => {
      this.closeListeners.forEach((l) => l());
    });
    conn.on('error', (err) => {
      this.errorListeners.forEach((l) => l(String((err as Error).message || err)));
    });
    if (conn.open) {
      this.openListeners.forEach((l) => l());
    } else {
      conn.on('open', () => this.openListeners.forEach((l) => l()));
    }
  }

  send(msg: NetMessage) {
    if (this.conn && this.conn.open) {
      this.conn.send(msg);
    }
  }

  isConnected() {
    return !!this.conn && this.conn.open;
  }

  destroy() {
    try {
      this.conn?.close();
    } catch {
      /* ignore */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
  }
}
