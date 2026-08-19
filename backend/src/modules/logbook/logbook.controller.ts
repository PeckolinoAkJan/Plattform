import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, type CurrentUserValue } from "../../common/decorators/current-user.decorator";
import { ClientSignatureGuard } from "../../common/guards/client-signature.guard";
import { LogbookService } from "./logbook.service";
import { SubmitTripDto } from "./dto/submit-trip.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("logbook")
export class LogbookController {
  constructor(private readonly logbookService: LogbookService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  listTrips(@CurrentUser() user: CurrentUserValue) {
    return this.logbookService.getTripsForUser(user.userId);
  }

  @Post("submit")
  @UseGuards(JwtAuthGuard, ClientSignatureGuard)
  async submitTrip(
    @CurrentUser() user: CurrentUserValue,
    @Body() submitTripDto: SubmitTripDto,
  ) {
    const result = await this.logbookService.submitTrip(user.userId, submitTripDto);

    return {
      message: "Fahrt erfolgreich übermittelt und klassifiziert",
      tripId: result.id,
      category: result.mode,
      payload: result.payload,
    };
  }
}
