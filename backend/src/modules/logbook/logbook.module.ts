import { Module } from "@nestjs/common";
import { ClientSignatureGuard } from "../../common/guards/client-signature.guard";
import { LogbookController } from "./logbook.controller";
import { LogbookService } from "./logbook.service";
import { TripClassifierService } from "./trip-classifier.service";

@Module({
  controllers: [LogbookController],
  providers: [LogbookService, TripClassifierService, ClientSignatureGuard],
  exports: [LogbookService],
})
export class LogbookModule {}
