import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TattooArtistService } from './tattoo-artist.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

// ---------------------------------------------------------------------------
// Prisma 7 requires Node 20+ for `prisma generate`. In environments where
// the Prisma Client is already generated (CI, Docker) these tests run as-is.
// Locally we mock everything so we never import generated Prisma artifacts.
// ---------------------------------------------------------------------------

/** Tiny shim that mimics Prisma.Decimal for the test only */
class FakeDecimal {
  private val: number;
  constructor(v: string | number) {
    this.val = Number(v);
  }
  toNumber() {
    return this.val;
  }
  toString() {
    return String(this.val);
  }
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const mockArtist = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  city: 'Amsterdam',
  country: 'Netherlands',
  countryCode: 'NL',
  address: 'Damrak 1',
  nickname: 'ink_master',
  description: 'Test description',
  styles: ['Traditional', 'Japanese'],
  instagram: '@ink_master',
  avatar: 'https://example.com/avatar.jpg',
  beginner: false,
  coverups: false,
  color: true,
  blackAndGray: false,
  email: null,
  website: null,
  tiktok: null,
  facebook: null,
  telegram: null,
  whatsapp: null,
  wechat: null,
  snapchat: null,
  photos: [],
  lat: new FakeDecimal('52.374000'),
  lon: new FakeDecimal('4.897000'),
  regionName: 'North Holland',
  regionCode: 'NH',
  regionCodeFull: 'NL-NH',
  postcode: '1012 JS',
  streetName: 'Damrak',
  addressNumber: '1',
  routableLat: null,
  routableLon: null,
  geoRaw: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

const mockUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  googleId: 'google-123',
  name: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  role: 'USER',
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

const createMockPrisma = () => ({
  artist: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  like: {
    count: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    groupBy: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
});

const createMockUploads = () => ({
  deleteAllForUser: jest.fn(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TattooArtistService', () => {
  let service: TattooArtistService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let uploads: ReturnType<typeof createMockUploads>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    uploads = createMockUploads();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TattooArtistService,
        { provide: PrismaService, useValue: prisma },
        { provide: UploadsService, useValue: uploads },
      ],
    }).compile();

    service = module.get<TattooArtistService>(TattooArtistService);
  });

  // ---- findAll -----------------------------------------------------------

  describe('findAll', () => {
    it('should return all artists with lat/lon as numbers', async () => {
      const artist = mockArtist();
      prisma.artist.findMany.mockResolvedValue([artist]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].lat).toBe(52.374);
      expect(result[0].lon).toBe(4.897);
      expect(typeof result[0].lat).toBe('number');
      expect(typeof result[0].lon).toBe('number');
    });

    it('should handle null lat/lon', async () => {
      const artist = mockArtist({ lat: null, lon: null });
      prisma.artist.findMany.mockResolvedValue([artist]);

      const result = await service.findAll();

      expect(result[0].lat).toBeNull();
      expect(result[0].lon).toBeNull();
    });

    it('should return empty array when no artists exist', async () => {
      prisma.artist.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ---- findByUserId ------------------------------------------------------

  describe('findByUserId', () => {
    it('should return artist with likes count', async () => {
      prisma.artist.findUnique.mockResolvedValue(mockArtist());
      prisma.like.count.mockResolvedValue(5);

      const result = await service.findByUserId('user-1');

      expect(result).toBeDefined();
      expect(result!.likes).toBe(5);
      expect(result!.nickname).toBe('ink_master');
    });

    it('should return null when artist not found', async () => {
      prisma.artist.findUnique.mockResolvedValue(null);
      prisma.like.count.mockResolvedValue(0);

      const result = await service.findByUserId('non-existent');

      expect(result).toBeNull();
    });
  });

  // ---- search ------------------------------------------------------------

  describe('search', () => {
    const baseParams = {
      styles: [] as string[],
      countryCode: null,
      regionCode: null,
      city: null,
      q: null,
      centerLat: null,
      centerLon: null,
      radiusKm: null,
      limit: 500,
    };

    it('should return artists with likes counts', async () => {
      const artist = mockArtist();
      prisma.artist.findMany.mockResolvedValue([artist]);
      prisma.like.groupBy.mockResolvedValue([
        { artistId: 'user-1', _count: { artistId: 3 } },
      ]);

      const result = await service.search(baseParams);

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).likes).toBe(3);
    });

    it('should filter by country code (case-insensitive)', async () => {
      prisma.artist.findMany.mockResolvedValue([]);
      prisma.like.groupBy.mockResolvedValue([]);

      await service.search({ ...baseParams, countryCode: 'nl' });

      const where = prisma.artist.findMany.mock.calls[0][0].where;
      expect(where.AND).toContainEqual({
        countryCode: { in: ['NL', 'nl'] },
      });
    });

    it('should filter by styles with variants', async () => {
      prisma.artist.findMany.mockResolvedValue([]);
      prisma.like.groupBy.mockResolvedValue([]);

      await service.search({ ...baseParams, styles: ['traditional'] });

      const where = prisma.artist.findMany.mock.calls[0][0].where;
      expect(where.AND).toContainEqual(
        expect.objectContaining({
          styles: {
            hasSome: expect.arrayContaining([
              'traditional',
              'TRADITIONAL',
              'Traditional',
            ]),
          },
        }),
      );
    });

    it('should clamp limit to max 2000', async () => {
      prisma.artist.findMany.mockResolvedValue([]);
      prisma.like.groupBy.mockResolvedValue([]);

      await service.search({ ...baseParams, limit: 5000 });

      expect(prisma.artist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2000 }),
      );
    });

    it('should clamp limit to min 1', async () => {
      prisma.artist.findMany.mockResolvedValue([]);
      prisma.like.groupBy.mockResolvedValue([]);

      await service.search({ ...baseParams, limit: 0 });

      expect(prisma.artist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });

    it('should filter by city', async () => {
      prisma.artist.findMany.mockResolvedValue([]);
      prisma.like.groupBy.mockResolvedValue([]);

      await service.search({ ...baseParams, city: 'Amsterdam' });

      const where = prisma.artist.findMany.mock.calls[0][0].where;
      expect(where.AND).toContainEqual({
        city: { contains: 'Amsterdam', mode: 'insensitive' },
      });
    });

    it('should support text search via q param', async () => {
      prisma.artist.findMany.mockResolvedValue([]);
      prisma.like.groupBy.mockResolvedValue([]);

      await service.search({ ...baseParams, q: 'ink' });

      const where = prisma.artist.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { nickname: { contains: 'ink', mode: 'insensitive' } },
          { city: { contains: 'ink', mode: 'insensitive' } },
        ]),
      );
    });

    it('should apply radius search with bbox filter', async () => {
      const artist = mockArtist();
      prisma.artist.findMany.mockResolvedValue([artist]);

      const result = await service.search({
        ...baseParams,
        centerLat: 52.374,
        centerLon: 4.897,
        radiusKm: 10,
      });

      // Should apply lat/lon NOT null filter
      const where = prisma.artist.findMany.mock.calls[0][0].where;
      expect(where.AND).toContainEqual({
        lat: { not: null },
        lon: { not: null },
      });

      // Result should include the artist (within 10km of itself)
      expect(result).toHaveLength(1);
    });

    it('should return 0 likes when no likes exist', async () => {
      prisma.artist.findMany.mockResolvedValue([mockArtist()]);
      prisma.like.groupBy.mockResolvedValue([]);

      const result = await service.search(baseParams);

      expect((result[0] as Record<string, unknown>).likes).toBe(0);
    });
  });

  // ---- topByLikes --------------------------------------------------------

  describe('topByLikes', () => {
    it('should return top artists by likes', async () => {
      const artist = { ...mockArtist(), _count: { likes: 10 } };
      prisma.artist.findMany.mockResolvedValue([artist]);

      const result = await service.topByLikes(5);

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).likes).toBe(10);
      expect(prisma.artist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          orderBy: { likes: { _count: 'desc' } },
        }),
      );
    });

    it('should default to 100 when limit not provided', async () => {
      prisma.artist.findMany.mockResolvedValue([]);

      await service.topByLikes();

      expect(prisma.artist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ---- likeArtist --------------------------------------------------------

  describe('likeArtist', () => {
    it('should create a like and return updated count', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.artist.findUnique.mockResolvedValue(mockArtist());
      prisma.like.upsert.mockResolvedValue({});
      prisma.like.count.mockResolvedValue(3);

      const result = await service.likeArtist('user-1', 'artist-1');

      expect(result).toEqual({ artistId: 'artist-1', likes: 3 });
    });

    it('should throw BadRequestException when userId is empty', async () => {
      await expect(service.likeArtist('', 'artist-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when artistId is empty', async () => {
      await expect(service.likeArtist('user-1', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.artist.findUnique.mockResolvedValue(mockArtist());

      await expect(
        service.likeArtist('non-existent', 'artist-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when artist not found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.artist.findUnique.mockResolvedValue(null);

      await expect(
        service.likeArtist('user-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use upsert for idempotent likes', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.artist.findUnique.mockResolvedValue(mockArtist());
      prisma.like.upsert.mockResolvedValue({});
      prisma.like.count.mockResolvedValue(1);

      await service.likeArtist('user-1', 'artist-1');

      expect(prisma.like.upsert).toHaveBeenCalledWith({
        where: {
          userId_artistId: { userId: 'user-1', artistId: 'artist-1' },
        },
        create: { userId: 'user-1', artistId: 'artist-1' },
        update: {},
      });
    });
  });

  // ---- unlikeArtist ------------------------------------------------------

  describe('unlikeArtist', () => {
    it('should delete the like and return updated count', async () => {
      prisma.like.delete.mockResolvedValue({});
      prisma.like.count.mockResolvedValue(2);

      const result = await service.unlikeArtist('user-1', 'artist-1');

      expect(result).toEqual({ artistId: 'artist-1', likes: 2 });
    });

    it('should handle P2025 (record not found) gracefully', async () => {
      const prismaError: Error & { code?: string } = new Error('Record not found');
      prismaError.code = 'P2025';
      prisma.like.delete.mockRejectedValue(prismaError);
      prisma.like.count.mockResolvedValue(0);

      const result = await service.unlikeArtist('user-1', 'artist-1');

      expect(result).toEqual({ artistId: 'artist-1', likes: 0 });
    });

    it('should re-throw non-P2025 Prisma errors', async () => {
      const otherError: Error & { code?: string } = new Error('Connection failed');
      otherError.code = 'P2024';
      prisma.like.delete.mockRejectedValue(otherError);

      await expect(
        service.unlikeArtist('user-1', 'artist-1'),
      ).rejects.toThrow('Connection failed');
    });
  });

  // ---- isLikedBy ---------------------------------------------------------

  describe('isLikedBy', () => {
    it('should return liked: true when like exists', async () => {
      prisma.like.findUnique.mockResolvedValue({ id: 'like-1' });

      const result = await service.isLikedBy('user-1', 'artist-1');

      expect(result).toEqual({ artistId: 'artist-1', liked: true });
    });

    it('should return liked: false when like does not exist', async () => {
      prisma.like.findUnique.mockResolvedValue(null);

      const result = await service.isLikedBy('user-1', 'artist-1');

      expect(result).toEqual({ artistId: 'artist-1', liked: false });
    });
  });

  // ---- upsertForCurrentUser ----------------------------------------------

  describe('upsertForCurrentUser', () => {
    const upsertData = {
      city: 'Amsterdam',
      country: 'Netherlands',
      countryCode: 'nl',
      address: 'Damrak 1',
      nickname: 'ink_master',
      description: 'Test',
      styles: ['Traditional'],
      instagram: '@ink',
    };

    it('should normalize countryCode to uppercase', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.artist.upsert.mockResolvedValue(mockArtist());

      await service.upsertForCurrentUser('user-1', upsertData);

      const call = prisma.artist.upsert.mock.calls[0][0];
      expect(call.create.countryCode).toBe('NL');
      expect(call.update.countryCode).toBe('NL');
    });

    it('should set countryCode to null when empty string', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.artist.upsert.mockResolvedValue(mockArtist());

      await service.upsertForCurrentUser('user-1', {
        ...upsertData,
        countryCode: '  ',
      });

      const call = prisma.artist.upsert.mock.calls[0][0];
      expect(call.create.countryCode).toBeNull();
    });

    it('should use user avatar on create', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({ avatar: 'https://example.com/pic.jpg' }),
      );
      prisma.artist.upsert.mockResolvedValue(mockArtist());

      await service.upsertForCurrentUser('user-1', upsertData);

      const call = prisma.artist.upsert.mock.calls[0][0];
      expect(call.create.avatar).toBe('https://example.com/pic.jpg');
    });

    it('should default boolean fields to false', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.artist.upsert.mockResolvedValue(mockArtist());

      await service.upsertForCurrentUser('user-1', upsertData);

      const call = prisma.artist.upsert.mock.calls[0][0];
      expect(call.create.beginner).toBe(false);
      expect(call.create.coverups).toBe(false);
      expect(call.create.color).toBe(false);
      expect(call.create.blackAndGray).toBe(false);
    });
  });

  // ---- deleteForCurrentUser ----------------------------------------------

  describe('deleteForCurrentUser', () => {
    it('should delete likes, artist, and S3 files', async () => {
      prisma.$transaction.mockResolvedValue([]);
      uploads.deleteAllForUser.mockResolvedValue(undefined);

      const result = await service.deleteForCurrentUser('user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(uploads.deleteAllForUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true });
    });
  });
});
