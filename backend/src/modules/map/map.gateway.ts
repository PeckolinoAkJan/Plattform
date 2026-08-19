import { Logger, UsePipes, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import {
  RawTelemetryPayload,
  TelemetryBroadcastPayload,
  resolveTelemetryCoordinates,
  resolveTelemetryCargo,
  resolveTelemetrySpeed,
  resolveTelemetryTimestamp,
  UpdateTelemetryDto,
} from "./interfaces/telemetry-payload.interface";

interface JwtPayload {
  companyId?: string;
  sub?: string;
}

type JoinPayload = string | { room?: string; companyId?: string };

const socketAllowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  namespace: "/telemetry",
  cors: { origin: socketAllowedOrigins, credentials: true },
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MapGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MapGateway.name);
  private readonly jwtSecret: string;
  private static readonly SESSION_COOKIE_NAME = "vtc_session";
  private static readonly MAX_SAFE_ROOM_LENGTH = 64;
  private static readonly ROOM_PREFIX = "room_company_";

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>("JWT_SECRET") ?? "";
  }

  handleConnection(client: Socket): void {
    const identity = this.extractIdentity(client);

    if (!identity?.sub) {
      this.logger.warn(`Nicht authentifizierte WebSocket-Verbindung abgelehnt: ${client.id}`);
      client.disconnect(true);
      return;
    }

    const companyId = this.getString(identity.companyId);
    const room = companyId ? this.getCompanyRoom(companyId) : "global";
    void client.join(room);
    client.data.userId = identity.sub;
    client.data.companyId = companyId;
    client.data.room = room;

    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  handleDisconnect(client: Socket): void {
    const room = this.getClientRoom(client);
    this.logger.log(`Client ${client.id} disconnected from ${room}`);
  }

  @SubscribeMessage("join_room")
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinPayload) {
    const { room, companyId } = this.normalizeJoinPayload(payload);
    const resolvedRoom = room ?? this.extractCompanyRoomFromPayload(client, payload);

    if (!resolvedRoom) {
      throw new WsException("join_room payload invalid");
    }

    if (!this.isRoomAllowed(client, resolvedRoom)) {
      throw new WsException("join_room payload invalid");
    }

    void client.join(resolvedRoom);
    if (companyId) {
      client.data.companyId = companyId;
    }
    client.data.room = resolvedRoom;

    this.logger.log(`Client ${client.id} manually joined room ${resolvedRoom}`);
    return { event: "joined", room: resolvedRoom };
  }

  @SubscribeMessage("join_company_room")
  handleJoinCompanyRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinPayload) {
    return this.handleJoinRoom(client, payload);
  }

  @SubscribeMessage("update_telemetry")
  handleUpdateTelemetry(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UpdateTelemetryDto,
  ) {
    const rawPayload = payload as RawTelemetryPayload;
    const roomCompanyId = this.getEffectiveCompanyId(client, rawPayload.companyId);
    const room = this.getCompanyRoom(roomCompanyId);
    const driverId = this.getString(client.data.userId);
    const position = resolveTelemetryCoordinates(rawPayload);
    const speedKmh = resolveTelemetrySpeed(rawPayload);

    if (!driverId || !position || speedKmh === null || speedKmh < 0) {
      throw new WsException("Ungültiger Telemetrie-Payload.");
    }

    const payloadForClients: Omit<TelemetryBroadcastPayload, "room"> = {
      driverId,
      userId: driverId,
      driverName: rawPayload.driverName,
      x: position.longitude,
      y: position.latitude,
      latitude: position.latitude,
      longitude: position.longitude,
      speed: speedKmh,
      speedKmh,
      truckModel: rawPayload.truckModel ?? "Unbekannt",
      heading: rawPayload.heading,
      timestamp: resolveTelemetryTimestamp(rawPayload),
      companyId: roomCompanyId,
      cargoName: resolveTelemetryCargo(rawPayload),
      sourceCity: rawPayload.sourceCity,
      destinationCity: rawPayload.destinationCity,
    };

    return this.emitTelemetryToRoom(room, payloadForClients);
  }

  public emitTelemetryToRoom(room: string, payload: Omit<TelemetryBroadcastPayload, "room">) {
    const normalizedRoom = this.normalizeRoom(room);
    if (!normalizedRoom) {
      return { deliveredTo: null };
    }

    const payloadForClients = {
      ...payload,
      room: normalizedRoom,
      timestamp: payload.timestamp,
    };

    this.server.to(normalizedRoom).emit("telemetry_stream", payloadForClients);

    return {
      deliveredTo: normalizedRoom,
      payload: payloadForClients,
    };
  }

  private normalizeJoinPayload(payload: JoinPayload): { room: string | null; companyId?: string | null } {
    if (typeof payload === "string") {
      return { room: payload.trim(), companyId: null };
    }

    const room = this.normalizeRoom(payload?.room);
    const companyId = this.getString(payload?.companyId);

    return { room, companyId };
  }

  private getEffectiveCompanyId(client: Socket, payloadCompanyId?: string): string {
    const roomCompanyId = this.getString(client.data.companyId);
    if (!roomCompanyId) {
      throw new WsException("Keine companyId für Telemetrie-Sendung gefunden.");
    }

    if (payloadCompanyId && payloadCompanyId !== roomCompanyId) {
      throw new WsException("Ungültige companyId im Payload.");
    }

    return roomCompanyId;
  }

  private extractCompanyRoomFromPayload(client: Socket, payload: JoinPayload): string | null {
    const payloadCompanyId = typeof payload === "object" && payload ? this.getString(payload.companyId) : null;
    if (payloadCompanyId) {
      return this.getCompanyRoom(payloadCompanyId);
    }

    const connectionCompanyId = this.getString(client.data.companyId);
    if (connectionCompanyId) {
      return this.getCompanyRoom(connectionCompanyId);
    }

    return null;
  }

  private isRoomAllowed(client: Socket, room: string): boolean {
    if (!room || room.length > MapGateway.MAX_SAFE_ROOM_LENGTH) {
      return false;
    }

    return this.getClientRoom(client) === room && this.isRoomNameWellFormed(room);
  }

  private isRoomNameWellFormed(room: string): boolean {
    return this.normalizeRoom(room) === room;
  }

  private normalizeRoom(room?: string | null): string | null {
    if (!room || typeof room !== "string") {
      return null;
    }

    const trimmed = room.trim();
    if (!trimmed.length) {
      return null;
    }

    if (trimmed === "global") {
      return "global";
    }

    if (trimmed.startsWith(MapGateway.ROOM_PREFIX)) {
      const suffix = trimmed.slice(MapGateway.ROOM_PREFIX.length);
      return suffix.length > 0 ? trimmed : null;
    }

    const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "-");
    if (!/^[a-zA-Z0-9._-]{4,}$/u.test(cleaned)) {
      return null;
    }

    return `${MapGateway.ROOM_PREFIX}${cleaned}`;
  }

  private getClientRoom(client: Socket): string | null {
    const companyId = this.getString(client.data.companyId);
    if (companyId) {
      return this.getCompanyRoom(companyId);
    }

    const room = this.getString(client.data.room);
    if (room) {
      return room;
    }

    return null;
  }

  private getCompanyRoom(companyId: string): string {
    return `${MapGateway.ROOM_PREFIX}${companyId}`;
  }

  private extractIdentity(client: Socket): JwtPayload | null {
    const auth = client.handshake.auth as { token?: string };
    const token = this.normalizeToken(
      auth?.token ||
      (this.getTokenFromCookie(client.handshake.headers.cookie) ?? undefined),
    );

    if (token && this.jwtSecret) {
      try {
        const decoded = this.jwtService.verify<JwtPayload>(token, { secret: this.jwtSecret });
        return decoded?.sub ? decoded : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  private getTokenFromCookie(cookieHeader?: string): string | null {
    if (!cookieHeader) return null;

    const match = cookieHeader.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${MapGateway.SESSION_COOKIE_NAME}=`));
    if (!match) return null;

    const parts = match.split("=");
    return parts.length >= 2 ? parts.slice(1).join("=") : null;
  }

  private normalizeToken(rawToken?: string): string | null {
    if (!rawToken) {
      return null;
    }

    if (rawToken.startsWith("Bearer ")) {
      return rawToken.slice(7);
    }

    return rawToken;
  }

  private getString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  }
}
