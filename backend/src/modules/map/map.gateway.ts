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
  resolveTelemetryDriverId,
  resolveTelemetrySpeed,
  resolveTelemetryTimestamp,
  UpdateTelemetryDto,
} from "./interfaces/telemetry-payload.interface";

interface JwtPayload {
  companyId?: string;
  sub?: string;
}

type JoinPayload = string | { room?: string; companyId?: string };

@WebSocketGateway({ namespace: "/telemetry", cors: { origin: "*" } })
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
    const companyId = this.extractCompanyId(client);

    if (!companyId) {
      this.logger.warn(`WebSocket-Verbindung ohne companyId: ${client.id}`);
      return;
    }

    const room = this.getCompanyRoom(companyId);
    void client.join(room);
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
    const driverId = resolveTelemetryDriverId(rawPayload);
    const position = resolveTelemetryCoordinates(rawPayload);
    const speedKmh = resolveTelemetrySpeed(rawPayload);

    if (!driverId || !position || speedKmh === null) {
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
    const roomCompanyId = payloadCompanyId ?? this.extractCompanyId(client);
    if (!roomCompanyId) {
      throw new WsException("Keine companyId für Telemetrie-Sendung gefunden.");
    }

    const allowedRoom = this.getClientRoom(client);
    const fromPayload = this.getCompanyRoom(roomCompanyId);
    if (allowedRoom && allowedRoom !== fromPayload) {
      throw new WsException("Ungültige companyId im Payload.");
    }

    return roomCompanyId;
  }

  private extractCompanyRoomFromPayload(client: Socket, payload: JoinPayload): string | null {
    const payloadCompanyId = typeof payload === "object" && payload ? this.getString(payload.companyId) : null;
    if (payloadCompanyId) {
      return this.getCompanyRoom(payloadCompanyId);
    }

    const connectionCompanyId = this.extractCompanyId(client);
    if (connectionCompanyId) {
      return this.getCompanyRoom(connectionCompanyId);
    }

    return null;
  }

  private isRoomAllowed(client: Socket, room: string): boolean {
    if (!room || room.length > MapGateway.MAX_SAFE_ROOM_LENGTH) {
      return false;
    }

    const connectionRoom = this.getClientRoom(client);
    if (!connectionRoom) {
      return this.isRoomNameWellFormed(room);
    }

    if (room === connectionRoom) {
      return true;
    }

    return this.isRoomNameWellFormed(room) && this.getAllowedCompanyFromRoom(room) === this.getAllowedCompanyFromRoom(connectionRoom);
  }

  private getAllowedCompanyFromRoom(room: string): string | null {
    if (!room.startsWith(MapGateway.ROOM_PREFIX)) {
      return null;
    }

    const raw = room.slice(MapGateway.ROOM_PREFIX.length);
    return raw.length > 0 ? raw : null;
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

  private extractCompanyId(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string; companyId?: string };
    const query = client.handshake.query as { token?: string; companyId?: string } | undefined;
    const token = this.normalizeToken(
      auth?.token ||
      (typeof query?.token === "string" ? query.token : undefined) ||
      (this.getTokenFromCookie(client.handshake.headers.cookie) ?? undefined),
    );

    if (token && this.jwtSecret) {
      try {
        const decoded = this.jwtService.verify<JwtPayload>(token, { secret: this.jwtSecret });
        if (decoded?.companyId) {
          return decoded.companyId;
        }
      } catch {
        // invalid token intentionally ignored for stream resilience
      }
    }

    const companyIdFromAuth = this.getString(auth?.companyId);
    if (companyIdFromAuth) {
      return companyIdFromAuth;
    }

    const companyIdFromQuery = this.getString(query?.companyId);
    if (companyIdFromQuery) {
      return companyIdFromQuery;
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
