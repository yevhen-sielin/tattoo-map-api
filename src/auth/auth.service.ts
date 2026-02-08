import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateOrCreateUser(googleProfile: {
    googleId: string;
    email: string;
    name?: string;
    avatar?: string;
  }): Promise<{ user: User; accessToken: string }> {
    this.logger.log(`Google auth: email=${googleProfile.email}`);

    let user = await this.prisma.user.findUnique({
      where: { googleId: googleProfile.googleId },
    });

    if (!user) {
      this.logger.log(`Creating new user for googleId=${googleProfile.googleId}`);

      user = await this.prisma.user.create({
        data: {
          googleId: googleProfile.googleId,
          email: googleProfile.email,
          name: googleProfile.name,
          avatar: googleProfile.avatar,
        },
      });
    } else {
      this.logger.log(`Existing user found: id=${user.id}`);
    }

    const payload = {
      sub: user.id,
      role: user.role,
      name: user.name ?? undefined,
      avatar: user.avatar ?? undefined,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return { user, accessToken };
  }
}
