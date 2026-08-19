import { Module } from "@nestjs/common";
import { MapController } from "./map.controller";
import { MapService } from "./map.service";
import { MapGateway } from "./map.gateway";

@Module({
  controllers: [MapController],
  providers: [MapService, MapGateway],
  exports: [MapService],
})
export class MapModule {}
