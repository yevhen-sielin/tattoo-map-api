import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
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
    console.log('🌐 Incoming Google profile:', googleProfile);

    let user = await this.prisma.user.findUnique({
      where: { googleId: googleProfile.googleId },
    });

    if (!user) {
      console.log('🆕 Creating new user...');

      user = await this.prisma.user.create({
        data: {
          googleId: googleProfile.googleId,
          email: googleProfile.email,
          name: googleProfile.name,
          avatar: googleProfile.avatar,
        },
      });
    } else {
      console.log('👤 User already exists:', user);
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
