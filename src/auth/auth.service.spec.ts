import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const mockUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-uuid-1',
  email: 'john@example.com',
  googleId: 'google-id-123',
  name: 'John Doe',
  avatar: 'https://lh3.googleusercontent.com/photo.jpg',
  role: 'USER',
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

const googleProfile = {
  googleId: 'google-id-123',
  email: 'john@example.com',
  name: 'John Doe',
  avatar: 'https://lh3.googleusercontent.com/photo.jpg',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ---- validateOrCreateUser: existing user --------------------------------

  describe('validateOrCreateUser — existing user', () => {
    it('should return existing user without creating a new one', async () => {
      const existingUser = mockUser();
      prisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.validateOrCreateUser(googleProfile);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: googleProfile.googleId },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user).toBe(existingUser);
    });

    it('should return a signed JWT token', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());

      const result = await service.validateOrCreateUser(googleProfile);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-uuid-1',
        role: 'USER',
        name: 'John Doe',
        avatar: 'https://lh3.googleusercontent.com/photo.jpg',
      });
    });

    it('should omit name/avatar from JWT payload when null', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({ name: null, avatar: null }),
      );

      await service.validateOrCreateUser(googleProfile);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-uuid-1',
        role: 'USER',
        name: undefined,
        avatar: undefined,
      });
    });
  });

  // ---- validateOrCreateUser: new user ------------------------------------

  describe('validateOrCreateUser — new user', () => {
    it('should create a new user when none exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser());

      const result = await service.validateOrCreateUser(googleProfile);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          googleId: googleProfile.googleId,
          email: googleProfile.email,
          name: googleProfile.name,
          avatar: googleProfile.avatar,
        },
      });
      expect(result.user).toEqual(mockUser());
      expect(result.accessToken).toBe('mock-jwt-token');
    });

    it('should handle profile without optional fields', async () => {
      const minimalProfile = {
        googleId: 'google-new',
        email: 'minimal@example.com',
      };
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(
        mockUser({
          googleId: 'google-new',
          email: 'minimal@example.com',
          name: undefined,
          avatar: undefined,
        }),
      );

      await service.validateOrCreateUser(minimalProfile);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          googleId: 'google-new',
          email: 'minimal@example.com',
          name: undefined,
          avatar: undefined,
        },
      });
    });
  });

  // ---- edge cases --------------------------------------------------------

  describe('edge cases', () => {
    it('should propagate Prisma errors', async () => {
      prisma.user.findUnique.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(
        service.validateOrCreateUser(googleProfile),
      ).rejects.toThrow('DB connection lost');
    });

    it('should propagate JWT signing errors', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      jwtService.signAsync.mockRejectedValue(
        new Error('JWT signing failed'),
      );

      await expect(
        service.validateOrCreateUser(googleProfile),
      ).rejects.toThrow('JWT signing failed');
    });
  });
});
