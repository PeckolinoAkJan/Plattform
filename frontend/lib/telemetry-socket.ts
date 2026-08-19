import { getStoredAuthToken } from './auth-client';
import { io, type Socket } from 'socket.io-client';

export const TELEMETRY_NAMESPACE = '/telemetry';
export const TELEMETRY_EVENTS = {
  JOIN_ROOM: 'join_room',
  JOIN_COMPANY_ROOM: 'join_company_room',
  TELEMETRY_STREAM: 'telemetry_stream',
} as const;

export const TELEMETRY_BACKEND_CONTRACT = {
  namespace: TELEMETRY_NAMESPACE,
  joinEvent: TELEMETRY_EVENTS.JOIN_ROOM,
  fallbackJoinEvent: TELEMETRY_EVENTS.JOIN_COMPANY_ROOM,
  streamEvent: TELEMETRY_EVENTS.TELEMETRY_STREAM,
  requiredPayloadFields: ['driverId', 'latitude', 'longitude', 'speed'] as const,
  optionalPayloadFields: ['speedKmh', 'x', 'y', 'cargoName', 'cargo', 'truckModel', 'sourceCity', 'destinationCity'] as const,
  aliases: {
    driverIdentifier: ['driverId', 'userId'],
    speed: ['speedKmh', 'speed'],
    coordinates: ['latitude', 'longitude'],
    coordsAlternate: ['y', 'x'],
    cargo: ['cargoName', 'cargo'],
  },
  minRoomSuffixLength: 4,
  roomPrefix: 'room_company_',
} as const;

export type TelemetryRoomSelector = {
  room?: string;
  companyId?: string;
};

export type TelemetryRoomContext = {
  room: string;
  roomLabel: string;
  selector: TelemetryRoomSelector;
  companyId: string | null;
  source: 'company' | 'fallback';
};

export type TelemetryContractField = (typeof TELEMETRY_BACKEND_CONTRACT.requiredPayloadFields)[number] | (typeof TELEMETRY_BACKEND_CONTRACT.optionalPayloadFields)[number];

export interface TelemetryEventDto {
  driverId: string;
  driverName?: string;
  speedKmh: number;
  latitude: number;
  longitude: number;
  cargoName?: string;
  sourceCity?: string;
  destinationCity?: string;
  truckModel?: string;
  heading?: number;
  room?: string;
  companyId?: string;
  timestamp: number;
}

export type RawTelemetryPayload = {
  driverId?: string;
  userId?: string;
  speedKmh?: number | string;
  speed?: number | string;
  latitude?: number;
  longitude?: number;
  x?: number;
  y?: number;
  cargo?: string;
  cargoName?: string;
  sourceCity?: string;
  destinationCity?: string;
  driverName?: string;
  truckModel?: string;
  heading?: number;
  room?: string;
  companyId?: string;
  timestamp?: number | string;
};

export type CreateTelemetrySocketParams = {
  baseUrl?: string;
  namespace?: string;
  room?: string;
  companyId?: string;
  autoConnect?: boolean;
};

const SOCKET_BASE_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

const ROOM_PREFIX = 'room_company_';
const DEFAULT_ROOM = 'global';
const MIN_ROOM_SUFFIX_LENGTH = 4;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toRequiredString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const resolveDriverId = (raw: Record<string, unknown>): string | null => {
  return toRequiredString(raw.driverId) || toRequiredString(raw.userId);
};

const resolveCoordinates = (
  raw: Record<string, unknown>,
): { latitude: number; longitude: number } | null => {
  const latitude = toNumber(raw.latitude ?? raw.y);
  const longitude = toNumber(raw.longitude ?? raw.x);

  if (latitude === null || longitude === null) {
    return null;
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }

  return { latitude, longitude };
};

const resolveSpeed = (raw: Record<string, unknown>): number | null => {
  const speedKmh = toNumber(raw.speedKmh ?? raw.speed);
  if (speedKmh === null) {
    return null;
  }

  return speedKmh < 0 ? null : speedKmh;
};

const resolveCargo = (raw: Record<string, unknown>): string | undefined => {
  return toRequiredString(raw.cargoName) || toRequiredString(raw.cargo) || undefined;
};

const resolveTimestamp = (raw: Record<string, unknown>): number => {
  const candidate = raw.timestamp;

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === 'string') {
    const asDate = Date.parse(candidate);
    if (!Number.isNaN(asDate)) {
      return asDate;
    }
  }

  return Date.now();
};

export const buildRoomFromCompanyId = (companyId: string): string => {
  const normalized = toRequiredString(companyId);
  if (!normalized) {
    return DEFAULT_ROOM;
  }

  const cleaned = normalized.replace(/[^a-zA-Z0-9._-]/g, '-');
  const suffix = cleaned.length ? cleaned : 'unknown';
  return `${ROOM_PREFIX}${suffix}`;
};

export const normalizeTelemetryRoom = (rawRoom: string | null | undefined): string | null => {
  const value = toRequiredString(rawRoom);
  if (!value) return null;

  if (value === 'global') {
    return value;
  }

  if (value.startsWith(ROOM_PREFIX)) {
    return value;
  }

  const normalized = value.replace(/[^a-zA-Z0-9._-]/g, '-');
  if (!/^[a-zA-Z0-9._-]+$/u.test(normalized)) {
    return null;
  }

  const suff = normalized.length > 0 ? normalized : 'global';
  return `${ROOM_PREFIX}${suff}`;
};

export const validateTelemetryPayload = (raw: unknown): boolean => {
  return parseTelemetryPayload(raw) !== null;
};

export const validateTelemetryBackendContract = () => {
  const required = [...TELEMETRY_BACKEND_CONTRACT.requiredPayloadFields];
  const optional = [...TELEMETRY_BACKEND_CONTRACT.optionalPayloadFields];

  if (!required.includes('driverId')) {
    throw new Error('Telemetry backend contract drift: driverId missing.');
  }

  if (!required.includes('latitude') || !required.includes('longitude')) {
    throw new Error('Telemetry backend contract drift: coordinate fields missing.');
  }

  if (!TELEMETRY_BACKEND_CONTRACT.joinEvent || !TELEMETRY_BACKEND_CONTRACT.streamEvent || !TELEMETRY_BACKEND_CONTRACT.namespace) {
    throw new Error('Telemetry backend contract drift: namespace/events mismatch.');
  }

  return {
    namespace: TELEMETRY_BACKEND_CONTRACT.namespace,
    joinEvent: TELEMETRY_BACKEND_CONTRACT.joinEvent,
    fallbackJoinEvent: TELEMETRY_BACKEND_CONTRACT.fallbackJoinEvent,
    streamEvent: TELEMETRY_BACKEND_CONTRACT.streamEvent,
    required: required as TelemetryContractField[],
    optional: optional as TelemetryContractField[],
  };
};

export const createTelemetryContext = (companyId?: string | null): TelemetryRoomContext => {
  const normalizedCompanyId = toRequiredString(companyId);
  if (!normalizedCompanyId) {
    return {
      room: DEFAULT_ROOM,
      roomLabel: DEFAULT_ROOM,
      selector: { room: DEFAULT_ROOM },
      companyId: null,
      source: 'fallback',
    };
  }

  const room = buildRoomFromCompanyId(normalizedCompanyId);
  return {
    room,
    roomLabel: room,
    selector: { companyId: normalizedCompanyId },
    companyId: normalizedCompanyId,
    source: 'company',
  };
};

export const normalizeRoomInputOrFallback = (rawRoom: string | null | undefined): string | null => {
  const normalized = normalizeTelemetryRoom(rawRoom);
  if (!normalized || normalized.length < (MIN_ROOM_SUFFIX_LENGTH + TELEMETRY_BACKEND_CONTRACT.roomPrefix.length)) {
    return null;
  }
  return normalized;
};

export function parseTelemetryPayload(raw: unknown): TelemetryEventDto | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const driverId = resolveDriverId(record);
  if (!driverId) {
    return null;
  }

  const coords = resolveCoordinates(record);
  const speedKmh = resolveSpeed(record);
  if (!coords || speedKmh === null) {
    return null;
  }

  return {
    driverId,
    driverName: toRequiredString(record.driverName) ?? undefined,
    speedKmh,
    latitude: coords.latitude,
    longitude: coords.longitude,
    cargoName: resolveCargo(record),
    sourceCity: toRequiredString(record.sourceCity) ?? undefined,
    destinationCity: toRequiredString(record.destinationCity) ?? undefined,
    truckModel: toRequiredString(record.truckModel) ?? undefined,
    heading: toNumber(record.heading) ?? undefined,
    room: toRequiredString(record.room) ?? undefined,
    companyId: toRequiredString(record.companyId) ?? undefined,
    timestamp: resolveTimestamp(record),
  };
}

export const buildJoinPayload = (selector: TelemetryRoomSelector | null | undefined) => {
  if (!selector) return null;
  if (selector.companyId) {
    const normalizedCompanyId = toRequiredString(selector.companyId);
    if (!normalizedCompanyId) return null;
    return { companyId: normalizedCompanyId };
  }

  const room = normalizeTelemetryRoom(selector.room);
  if (!room) return null;
  return { room };
};

export const emitJoinRoom = (socket: Socket, selector: TelemetryRoomSelector | string) => {
  if (typeof selector === 'string') {
    const room = normalizeTelemetryRoom(selector);
    if (!room) {
      return;
    }
    socket.emit(TELEMETRY_EVENTS.JOIN_ROOM, { room });
    return;
  }

  const payload = buildJoinPayload(selector);
  if (!payload) {
    return;
  }

  socket.emit(TELEMETRY_EVENTS.JOIN_ROOM, payload);
};

export const createTelemetrySocket = ({
  baseUrl = SOCKET_BASE_URL,
  namespace = TELEMETRY_NAMESPACE,
  room,
  companyId,
  autoConnect = true,
}: CreateTelemetrySocketParams): Socket<RawTelemetryPayload, RawTelemetryPayload> => {
  const token = getStoredAuthToken();
  const joinRoom = toRequiredString(room);
  const joinCompany = toRequiredString(companyId);

  return io(`${baseUrl}${namespace}`, {
    path: '/socket.io',
    transports: ['websocket'],
    withCredentials: true,
    auth: token ? { token } : undefined,
    query: joinCompany
      ? { companyId: joinCompany }
      : joinRoom
        ? { room: joinRoom }
        : undefined,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 900,
    reconnectionDelayMax: 6_000,
    autoConnect,
    timeout: 18_000,
    forceNew: true,
  });
};

