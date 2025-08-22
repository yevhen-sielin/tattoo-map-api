import type { Role } from '@prisma/client';

export type SeedArtist = {
  nickname: string;
  city: string;
  country: string;
  countryCode?: string | null;
  address: string;
  description: string;
  styles: string[];
  instagram: string;
  avatar: string;
  lat?: number | null;
  lon?: number | null;
};

export type SeedUser = {
  id?: string;
  email: string;
  googleId: string;
  name?: string | null;
  avatar?: string | null;
  role?: Role;
  artist: SeedArtist;
};

const names = [
  'Eva Noir',
  'Leo Ink',
  'Mila Shade',
  'Noah Veld',
  'Luna Stark',
  'Finn Blauw',
  'Iris Nova',
  'Max Raven',
  'Nora Flint',
  'Zoe Vale',
];

const nicknames = [
  'eva.noir',
  'leo.ink',
  'mila.shade',
  'noah.veld',
  'luna.stark',
  'finn.blauw',
  'iris.nova',
  'max.raven',
  'nora.flint',
  'zoe.vale',
];

const cities = ['Amsterdam', 'Rotterdam', 'Utrecht', 'The Hague', 'Eindhoven'];

const addresses = [
  'Damstraat 21',
  'Nieuwe Binnenweg 44',
  'Oudegracht 120',
  'Grote Markt 5',
  'Stratumseind 9',
];

const stylesPool = [
  'blackwork',
  'geometric',
  'realism',
  'portrait',
  'traditional',
  'watercolor',
  'tribal',
  'fine-line',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickStyles(): string[] {
  const count = 1 + Math.floor(Math.random() * 3);
  const shuffled = [...stylesPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomNlLat(): number {
  // Netherlands approx bounds: lat 50.7500 - 53.7000
  return 50.75 + Math.random() * (53.7 - 50.75);
}

function randomNlLon(): number {
  // Netherlands approx bounds: lon 3.2000 - 7.2000 (East)
  return 3.2 + Math.random() * (7.2 - 3.2);
}

export function makeRandomUsers(count: number): SeedUser[] {
  const users: SeedUser[] = [];
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length];
    const nickname = nicknames[i % nicknames.length];
    const city = pick(cities);
    const address = pick(addresses);
    const styles = pickStyles();
    const emailLocal = nickname.replace(/\./g, '_');
    const email = `${emailLocal}@example.com`;
    const googleId = `${nickname}-google-id`;
    const avatar = `https://i.pravatar.cc/300?img=${(i % 70) + 1}`;
    const instagram = `https://instagram.com/${nickname}`;

    users.push({
      id: `seed-user-${i + 1}`,
      email,
      googleId,
      name,
      avatar,
      role: 'USER',
      artist: {
        nickname,
        city,
        country: 'Netherlands',
        countryCode: 'NL',
        address,
        description: 'Tattoo artist in NL. Auto-generated seed profile.',
        styles,
        instagram,
        avatar,
        lat: randomNlLat(),
        lon: randomNlLon(),
      },
    });
  }
  return users;
}

export const defaultSeedUsers: SeedUser[] = [
  {
    id: 'seed-user-1',
    email: 'eva@example.com',
    googleId: 'eva-google-id',
    name: 'Eva Noir',
    avatar: 'https://example.com/eva.jpg',
    role: 'ADMIN',
    artist: {
      nickname: 'eva.noir',
      city: 'Amsterdam',
      country: 'Netherlands',
      countryCode: 'NL',
      address: 'Damstraat 21',
      description: 'Specializes in blackwork and geometric tattoos.',
      styles: ['blackwork', 'geometric'],
      instagram: 'https://instagram.com/eva.noir',
      avatar: 'https://example.com/eva.jpg',
      lat: 52.372759,
      lon: 4.893604,
    },
  },
  {
    id: 'seed-user-2',
    email: 'leo@example.com',
    googleId: 'leo-google-id',
    name: 'Leo Ink',
    avatar: 'https://example.com/leo.jpg',
    role: 'USER',
    artist: {
      nickname: 'leo.ink',
      city: 'Rotterdam',
      country: 'Netherlands',
      countryCode: 'NL',
      address: 'Nieuwe Binnenweg 44',
      description: 'Portrait and realism expert.',
      styles: ['realism', 'portrait'],
      instagram: 'https://instagram.com/leo.ink',
      avatar: 'https://example.com/leo.jpg',
      lat: 51.924420,
      lon: 4.477733,
    },
  },
];


