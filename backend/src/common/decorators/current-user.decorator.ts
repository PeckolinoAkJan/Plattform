import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentUserValue {
  userId: string;
  role?: string;
  companyId?: string | null;
  steamId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserValue => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);
