import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtStrategy } from '../auth/jwt.strategy';

type PendingPrompt = {
  id: string;
  userId: string;
  action: string;
  scope: string;
  reason: string;
  resolve: (decision: 'allow' | 'deny' | 'always') => void;
  timer: NodeJS.Timeout;
};

/**
 * Real-time permission prompt gateway.
 *
 * Flow:
 *   1. A plugin asks the PermissionEngine to authorize an action.
 *   2. Engine has no cached grant → calls `gateway.prompt(userId, action, scope, reason)`.
 *   3. Gateway pushes `permission:prompt` to the user's active socket(s).
 *   4. Web UI resolves with `permission:decision { id, decision }`.
 *   5. Promise resolves; engine persists grant if `always`.
 */
@Injectable()
@WebSocketGateway({ namespace: '/permissions', cors: { origin: true, credentials: true } })
export class PermissionsGateway implements OnGatewayConnection {
  private readonly log = new Logger(PermissionsGateway.name);
  @WebSocketServer() server!: Server;

  private readonly pending = new Map<string, PendingPrompt>();
  private readonly sockets = new Map<string, Set<Socket>>(); // userId → sockets

  constructor(private readonly jwtStrategy: JwtStrategy) {}

  async handleConnection(socket: Socket) {
    // Verify JWT from socket handshake — reject unauthenticated connections
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      this.log.warn('WebSocket connection rejected: no auth token');
      socket.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtStrategy.verify(token);
      const userId = payload.sub;
      if (!userId) {
        socket.disconnect(true);
        return;
      }

      // Attach userId to socket data for later use
      (socket as any).userId = userId;

      if (!this.sockets.has(userId)) this.sockets.set(userId, new Set());
      this.sockets.get(userId)!.add(socket);
      socket.on('disconnect', () => this.sockets.get(userId)?.delete(socket));
      this.log.debug(`Permission socket connected for user ${userId}`);
    } catch (err) {
      this.log.warn('WebSocket connection rejected: invalid token');
      socket.disconnect(true);
    }
  }

  prompt(userId: string, action: string, scope: string, reason: string, ttlMs = 60_000) {
    return new Promise<'allow' | 'deny' | 'always'>((resolve) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) resolve('deny');
      }, ttlMs);
      this.pending.set(id, { id, userId, action, scope, reason, resolve, timer });
      const payload = { id, action, scope, reason, expiresAt: Date.now() + ttlMs };
      this.sockets.get(userId)?.forEach((s) => s.emit('permission:prompt', payload));
      this.log.log(`prompt ${id} → ${userId} ${action}:${scope}`);
    });
  }

  @SubscribeMessage('permission:decision')
  onDecision(
    @MessageBody() body: { id: string; decision: 'allow' | 'deny' | 'always' },
    @ConnectedSocket() socket: Socket,
  ) {
    const p = this.pending.get(body.id);
    if (!p) return { ok: false, reason: 'expired' };

    // Verify the socket belongs to the user who owns this prompt
    const socketUserId = (socket as any).userId;
    if (socketUserId !== p.userId) {
      this.log.warn(`Permission decision rejected: socket user ${socketUserId} != prompt user ${p.userId}`);
      return { ok: false, reason: 'unauthorized' };
    }

    clearTimeout(p.timer);
    this.pending.delete(body.id);
    p.resolve(body.decision);
    return { ok: true };
  }

  /** Panic revoke — kill every in-flight prompt for a user (deny-all). */
  panicRevoke(userId: string) {
    for (const [id, p] of this.pending) {
      if (p.userId === userId) {
        clearTimeout(p.timer);
        p.resolve('deny');
        this.pending.delete(id);
      }
    }
    this.sockets.get(userId)?.forEach((s) => s.emit('permission:panic'));
  }
}
