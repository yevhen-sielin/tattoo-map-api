import { PrismaClient, Prisma } from '@prisma/client';
import { defaultSeedUsers, makeRandomUsers, type SeedUser } from './seed-data';

const prisma = new PrismaClient();

function toDecimal6(value?: number | null): Prisma.Decimal | null {
  if (value == null) return null;
  return new Prisma.Decimal(value.toFixed(6));
}

async function upsertUserWithArtist(tx: PrismaClient, u: SeedUser) {
  const user = await tx.user.upsert({
    where: { email: u.email },
    create: {
      email: u.email,
      googleId: u.googleId,
      name: u.name ?? null,
      avatar: u.avatar ?? null,
      role: u.role ?? 'USER',
      artist: {
        create: {
          nickname: u.artist.nickname,
          city: u.artist.city,
          country: u.artist.country,
          address: u.artist.address,
          description: u.artist.description,
          styles: u.artist.styles,
          instagram: u.artist.instagram,
          avatar: u.artist.avatar,
          lat: toDecimal6(u.artist.lat),
          lon: toDecimal6(u.artist.lon),
        },
      },
    },
    update: {
      googleId: u.googleId,
      name: u.name ?? null,
      avatar: u.avatar ?? null,
      role: u.role ?? 'USER',
      artist: {
        upsert: {
          create: {
            nickname: u.artist.nickname,
            city: u.artist.city,
            country: u.artist.country,
            address: u.artist.address,
            description: u.artist.description,
            styles: u.artist.styles,
            instagram: u.artist.instagram,
            avatar: u.artist.avatar,
            lat: toDecimal6(u.artist.lat),
            lon: toDecimal6(u.artist.lon),
          },
          update: {
            nickname: u.artist.nickname,
            city: u.artist.city,
            country: u.artist.country,
            address: u.artist.address,
            description: u.artist.description,
            styles: u.artist.styles,
            instagram: u.artist.instagram,
            avatar: u.artist.avatar,
            lat: toDecimal6(u.artist.lat),
            lon: toDecimal6(u.artist.lon),
          },
        },
      },
    },
  });
  return user;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seeding is disabled in production');
    process.exit(1);
  }

  const COUNT = Number(process.env.SEED_COUNT ?? 8);
  const users: SeedUser[] = [
    ...defaultSeedUsers,
    ...makeRandomUsers(COUNT),
  ];

  console.info(`Seeding ${users.length} users/artists...`);
  await prisma.$transaction(async (tx) => {
    for (const u of users) {
      await upsertUserWithArtist(tx as unknown as PrismaClient, u);
    }
  });

  console.info('✅ Seeding complete');
}

main()
  .catch((e: Error) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
