import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, type CurrentUserValue } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ChatService } from "./chat.service";
import { CreateChatMessageDto } from "./dto/create-chat-message.dto";
import { GetChatMessagesQueryDto } from "./dto/get-chat-messages.query.dto";

@Controller("chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("messages")
  getMessages(
    @CurrentUser() user: CurrentUserValue,
    @Query() query: GetChatMessagesQueryDto,
  ) {
    return this.chatService.getMessages(user.userId, query.limit);
  }

  @Post("messages")
  createMessage(
    @CurrentUser() user: CurrentUserValue,
    @Body() dto: CreateChatMessageDto,
  ) {
    return this.chatService.createMessage(user.userId, dto.body);
  }
}
