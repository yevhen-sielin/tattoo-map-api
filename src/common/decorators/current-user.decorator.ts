import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Extract the authenticated user from the request object.
 * Works with JwtAuthGuard and OptionalJwtAuthGuard.
 *
 * Usage: `@CurrentUser() user: JwtUser`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().user,
);
