import type { NetMessage } from '../types';

/**
 * The slice of the network layer the game actually uses. `Connection` (PeerJS)
 * satisfies it for PvP; `OfflineConnection` satisfies it for the practice range,
 * so GameCanvas never has to know which one it is talking to.
 */
export interface GameConnection {
  send(msg: NetMessage): void;
  onMessage(cb: (msg: NetMessage) => void): () => void;
  onClose(cb: () => void): () => void;
  isConnected(): boolean;
}

/** No-op connection for offline practice: sends go nowhere, nothing ever closes. */
export class OfflineConnection implements GameConnection {
  send(): void {
    /* practice is local-only */
  }

  onMessage(): () => void {
    return () => {};
  }

  onClose(): () => void {
    return () => {};
  }

  isConnected(): boolean {
    return true;
  }
}
