import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TattooArtistService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.artist.findMany().then((artists) =>
      artists.map((a) => ({
        ...a,
        lat: a.lat == null ? null : parseFloat(a.lat.toString()),
        lon: a.lon == null ? null : parseFloat(a.lon.toString()),
      })),
    );
  }

  async findByUserId(userId: string) {
    const a = await this.prisma.artist.findUnique({ where: { userId } });
    if (!a) return null;
    return {
      ...a,
      lat: a.lat == null ? null : parseFloat(a.lat.toString()),
      lon: a.lon == null ? null : parseFloat(a.lon.toString()),
    };
  }

  async upsertForCurrentUser(
    userId: string,
    data: {
      city: string;
      country: string;
      countryCode?: string | null;
      address: string;
      nickname: string;
      description: string;
      styles: string[];
      instagram: string;
      avatar: string;
      photos?: string[];
      lat?: number | null;
      lon?: number | null;
    },
  ) {
    const updateData: any = {
      city: data.city,
      country: data.country,
      countryCode: data.countryCode ?? null,
      address: data.address,
      nickname: data.nickname,
      description: data.description,
      styles: data.styles,
      instagram: data.instagram,
      avatar: data.avatar,
      photos: Array.isArray(data.photos) ? data.photos : undefined,
      lat: data.lat == null ? null : new Prisma.Decimal(data.lat),
      lon: data.lon == null ? null : new Prisma.Decimal(data.lon),
    };

    const createData: any = {
      userId,
      city: data.city,
      country: data.country,
      countryCode: data.countryCode ?? null,
      address: data.address,
      nickname: data.nickname,
      description: data.description,
      styles: data.styles,
      instagram: data.instagram,
      avatar: data.avatar,
      photos: Array.isArray(data.photos) ? data.photos : [],
      lat: data.lat == null ? null : new Prisma.Decimal(data.lat),
      lon: data.lon == null ? null : new Prisma.Decimal(data.lon),
    };

    return this.prisma.artist.upsert({
      where: { userId },
      update: updateData,
      create: createData,
    });
  }
}
