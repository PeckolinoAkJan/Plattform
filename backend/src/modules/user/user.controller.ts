import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import {
  CurrentUser,
  type CurrentUserValue,
} from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserService } from "./user.service";
import { UpdateUserProfileDto } from "./dto/update-user-profile.dto";
import { SetUserPasswordDto } from "./dto/set-user-password.dto";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("me")
  getMe(@CurrentUser() user: CurrentUserValue) {
    return this.userService.getProfile(user.userId);
  }

  @Patch("me")
  updateMe(
    @CurrentUser() user: CurrentUserValue,
    @Body() payload: UpdateUserProfileDto,
  ) {
    return this.userService.updateProfile(user.userId, payload);
  }

  @Patch("me/password")
  setPassword(
    @CurrentUser() user: CurrentUserValue,
    @Body() payload: SetUserPasswordDto,
  ) {
    return this.userService.setPassword(
      user.userId,
      payload.currentPassword,
      payload.newPassword,
    );
  }
}
