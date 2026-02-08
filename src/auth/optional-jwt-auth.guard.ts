import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard but never throws 401.
 * If the token is missing or invalid, req.user stays undefined
 * and the controller can handle "guest" access itself.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(err: Error | null, user: T): T | null {
    // Swallow authentication errors — return null so the route still executes
    if (err || !user) return null as T;
    return user;
  }

  canActivate(context: ExecutionContext) {
    // Run the JWT strategy but don't fail on missing/invalid token
    return super.canActivate(context);
  }
}
