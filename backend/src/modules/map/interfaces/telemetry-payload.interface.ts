import { IsNumber, IsOptional, IsString } from "class-validator";

type OptionalNumericInput = number | string | null | undefined;

export interface TelemetryRoomPayload {
  companyId: string;
  room: string;
}

export interface TelemetryBroadcastPayload {
  driverId?: string;
  driverName?: string;
  userId: string;
  x?: number;
  y?: number;
  latitude?: number;
  longitude?: number;
  speed: number;
  speedKmh?: number;
  truckModel: string;
  heading?: number | null;
  timestamp: string;
  companyId?: string;
  room?: string;
  cargoName?: string;
  sourceCity?: string | null;
  destinationCity?: string | null;
}

export interface RawTelemetryPayload {
  companyId?: string;
  userId?: string;
  driverId?: string;
  driverName?: string;
  x?: number;
  y?: number;
  latitude?: number;
  longitude?: number;
  speed?: number;
  speedKmh?: number;
  truckModel?: string;
  heading?: number;
  timestamp?: string;
  cargoName?: string;
  cargo?: string;
  sourceCity?: string;
  destinationCity?: string;
}

const toNumber = (value: OptionalNumericInput): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

export const resolveTelemetryDriverId = (payload: RawTelemetryPayload): string | null => {
  if (typeof payload.driverId === "string" && payload.driverId.trim().length > 0) {
    return payload.driverId.trim();
  }

  if (typeof payload.userId === "string" && payload.userId.trim().length > 0) {
    return payload.userId.trim();
  }

  return null;
};

export const resolveTelemetryCoordinates = (payload: {
  latitude?: OptionalNumericInput;
  longitude?: OptionalNumericInput;
  x?: OptionalNumericInput;
  y?: OptionalNumericInput;
}): { latitude: number; longitude: number } | null => {
  const latitude = toNumber(payload.latitude ?? payload.y);
  const longitude = toNumber(payload.longitude ?? payload.x);

  if (latitude === undefined || longitude === undefined) {
    return null;
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }

  return { latitude, longitude };
};

export const resolveTelemetrySpeed = (payload: { speed?: OptionalNumericInput; speedKmh?: OptionalNumericInput }): number | null => {
  return toNumber(payload.speedKmh ?? payload.speed) ?? null;
};

export const resolveTelemetryCargo = (payload: { cargoName?: string | null; cargo?: string | null }): string | undefined => {
  if (typeof payload.cargoName === "string" && payload.cargoName.trim().length > 0) {
    return payload.cargoName.trim();
  }

  if (typeof payload.cargo === "string" && payload.cargo.trim().length > 0) {
    return payload.cargo.trim();
  }

  return undefined;
};

export const resolveTelemetryTimestamp = (payload: { timestamp?: string | null }) => {
  if (!payload.timestamp) {
    return new Date().toISOString();
  }

  const parsed = Date.parse(payload.timestamp);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
};

export class UpdateTelemetryDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  driverName?: string;

  @IsString()
  @IsOptional()
  cargoName?: string;

  @IsString()
  @IsOptional()
  cargo?: string;

  @IsString()
  @IsOptional()
  sourceCity?: string;

  @IsString()
  @IsOptional()
  destinationCity?: string;

  @IsString()
  @IsOptional()
  truckModel?: string;

  @IsNumber()
  @IsOptional()
  x?: number;

  @IsNumber()
  @IsOptional()
  y?: number;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsNumber()
  @IsOptional()
  speed?: number;

  @IsNumber()
  @IsOptional()
  speedKmh?: number;

  @IsNumber()
  @IsOptional()
  heading?: number;

  @IsString()
  @IsOptional()
  timestamp?: string;
}
