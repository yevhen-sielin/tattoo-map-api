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
        create: ({
          nickname: u.artist.nickname,
          city: u.artist.city,
          country: u.artist.country,
          countryCode: u.artist.countryCode ?? 'NL',
          address: u.artist.address,
          description: u.artist.description,
          styles: u.artist.styles,
          instagram: u.artist.instagram,
          avatar: u.artist.avatar,
          beginner: Boolean(u.artist.beginner ?? false),
          color: Boolean(u.artist.color ?? false),
          blackAndGray: Boolean(u.artist.blackAndGray ?? false),
          photos: Array.isArray(u.artist.photos) ? u.artist.photos : [],
          lat: toDecimal6(u.artist.lat),
          lon: toDecimal6(u.artist.lon),
        } as any),
      },
    },
    update: {
      googleId: u.googleId,
      name: u.name ?? null,
      avatar: u.avatar ?? null,
      role: u.role ?? 'USER',
      artist: {
        upsert: {
          create: ({
            nickname: u.artist.nickname,
            city: u.artist.city,
            country: u.artist.country,
            countryCode: u.artist.countryCode ?? 'NL',
            address: u.artist.address,
            description: u.artist.description,
            styles: u.artist.styles,
            instagram: u.artist.instagram,
            avatar: u.artist.avatar,
            beginner: Boolean(u.artist.beginner ?? false),
            color: Boolean(u.artist.color ?? false),
            blackAndGray: Boolean(u.artist.blackAndGray ?? false),
            photos: Array.isArray(u.artist.photos) ? u.artist.photos : [],
            lat: toDecimal6(u.artist.lat),
            lon: toDecimal6(u.artist.lon),
          } as any),
          update: ({
            nickname: u.artist.nickname,
            city: u.artist.city,
            country: u.artist.country,
            countryCode: u.artist.countryCode ?? 'NL',
            address: u.artist.address,
            description: u.artist.description,
            styles: u.artist.styles,
            instagram: u.artist.instagram,
            avatar: u.artist.avatar,
            beginner: Boolean(u.artist.beginner ?? false),
            color: Boolean(u.artist.color ?? false),
            blackAndGray: Boolean(u.artist.blackAndGray ?? false),
            photos: Array.isArray(u.artist.photos) ? u.artist.photos : [],
            lat: toDecimal6(u.artist.lat),
            lon: toDecimal6(u.artist.lon),
          } as any),
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
  const createdUserIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const u of users) {
      const user = await upsertUserWithArtist(tx as unknown as PrismaClient, u);
      createdUserIds.push(user.id);
    }
  });

  // Create some initial likes to showcase the UI
  try {
    const artistIds = (await prisma.artist.findMany({ select: { userId: true } })).map((a) => a.userId);
    const pairs = new Set<string>();
    const likesData: { userId: string; artistId: string }[] = [];
    for (const uid of createdUserIds) {
      const sampleCount = Math.max(1, Math.min(3, Math.floor(Math.random() * 4))); // 1..3 likes per user
      const shuffled = [...artistIds].sort(() => Math.random() - 0.5);
      let added = 0;
      for (const aid of shuffled) {
        if (aid === uid) continue; // do not like self
        const key = `${uid}:${aid}`;
        if (pairs.has(key)) continue;
        pairs.add(key);
        likesData.push({ userId: uid, artistId: aid });
        added++;
        if (added >= sampleCount) break;
      }
    }
    if (likesData.length) {
      await prisma.like.createMany({ data: likesData, skipDuplicates: true });
      console.info(`👍 Seeded ${likesData.length} likes`);
    }
  } catch (e) {
    console.warn('Seed likes skipped:', e);
  }

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
