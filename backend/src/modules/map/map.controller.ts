import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, type CurrentUserValue } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateConvoyDto } from "./dto/create-convoy.dto";
import { GetLivePositionsQueryDto } from "./dto/get-live-positions.query.dto";
import { MapService } from "./map.service";
import { MapGateway } from "./map.gateway";
import { UpdateTelemetryDto } from "./interfaces/telemetry-payload.interface";

@Controller("map")
@UseGuards(JwtAuthGuard)
export class MapController {
  constructor(
    private readonly mapService: MapService,
    private readonly mapGateway: MapGateway,
  ) {}

  @Get("live-positions")
  async livePositions(
    @CurrentUser() user: CurrentUserValue,
    @Query() query: GetLivePositionsQueryDto,
  ) {
    const companyId = query?.companyId?.trim() || user.companyId || undefined;
    return this.mapService.getLivePositions({ companyId, maxAgeMinutes: query?.maxAgeMinutes });
  }

  @Post("convoys")
  async createConvoy(@CurrentUser() user: CurrentUserValue, @Body() body: CreateConvoyDto) {
    return this.mapService.createConvoy(user.userId, body);
  }

  @Post("update-telemetry")
  async updateTelemetry(
    @CurrentUser() user: CurrentUserValue,
    @Body() body: UpdateTelemetryDto,
  ) {
    const updateResult = await this.mapService.updateLiveTelemetry(user.userId, body);
    const broadcastPayload = {
      userId: updateResult.userId,
      x: updateResult.x,
      y: updateResult.y,
      latitude: updateResult.latitude,
      longitude: updateResult.longitude,
      speed: updateResult.speed,
      speedKmh: updateResult.speedKmh,
      truckModel: updateResult.truckModel,
      heading: updateResult.heading,
      timestamp: updateResult.timestamp,
      companyId: updateResult.companyId ?? undefined,
      driverId: updateResult.driverId,
      cargoName: updateResult.cargoName,
      sourceCity: updateResult.sourceCity,
      destinationCity: updateResult.destinationCity,
    };

    const deliveredTo = this.mapGateway.emitTelemetryToRoom(updateResult.room, broadcastPayload);

    return {
      ...updateResult,
      deliveredTo,
    };
  }
}
