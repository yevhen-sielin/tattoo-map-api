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
  beginner?: boolean;
  color?: boolean;
  blackAndGray?: boolean;
  photos?: string[];
  lat?: number | null;
  lon?: number | null;
  // New location fields
  regionName?: string | null;
  regionCode?: string | null;
  regionCodeFull?: string | null;
  postcode?: string | null;
  streetName?: string | null;
  addressNumber?: string | null;
  routableLat?: number | null;
  routableLon?: number | null;
  geoRaw?: any;
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
  'Eva Noir', 'Leo Ink', 'Mila Shade', 'Noah Veld', 'Luna Stark', 'Finn Blauw', 'Iris Nova', 'Max Raven', 'Nora Flint', 'Zoe Vale',
  'Alex Stone', 'Bella Moon', 'Casper Ink', 'Diana Rose', 'Erik Steel', 'Freya Wolf', 'Gunnar Frost', 'Hilda Storm', 'Ivan Dark', 'Jade Light',
  'Kai Shadow', 'Lara Fire', 'Mason River', 'Nina Star', 'Oscar Wind', 'Pia Ocean', 'Quinn Forest', 'Ruby Sky', 'Sage Mountain', 'Tara Dawn',
  'Ulrich Night', 'Vera Sun', 'Wade Earth', 'Xara Moon', 'Yuki Snow', 'Zara Rain', 'Aria Flame', 'Blake Storm', 'Cora Mist', 'Dexter Wave',
  'Elena Tide', 'Felix Rock', 'Gia Cloud', 'Hugo Star', 'Ivy Leaf', 'Jasper Stone', 'Kira Wind', 'Liam Fire', 'Maya Earth', 'Nico Sky',
  'Olive Rain', 'Phoenix Sun', 'Quinn Moon', 'Raven Night', 'Sage Dawn', 'Titan Storm', 'Uma Star', 'Viktor Fire', 'Willow Mist', 'Xander Wave',
  'Yara Light', 'Zane Dark', 'Aurora Flame', 'Blaze Storm', 'Crystal Ice', 'Drake Fire', 'Ember Moon', 'Frost Star', 'Glacier Wind', 'Haven Rain',
  'Iris Dawn', 'Jupiter Sun', 'Koda Moon', 'Luna Star', 'Mars Fire', 'Nova Light', 'Orion Dark', 'Polaris Sky', 'Quasar Storm', 'Rigel Wave',
  'Sirius Sun', 'Titan Moon', 'Ursa Star', 'Vega Light', 'Wolf Storm', 'Xena Fire', 'Yara Moon', 'Zeus Star', 'Alpha Dawn', 'Beta Night',
  'Gamma Sun', 'Delta Moon', 'Epsilon Star', 'Zeta Light', 'Eta Storm', 'Theta Fire', 'Iota Moon', 'Kappa Star', 'Lambda Dawn', 'Mu Night'
];

const nicknames = [
  'eva.noir', 'leo.ink', 'mila.shade', 'noah.veld', 'luna.stark', 'finn.blauw', 'iris.nova', 'max.raven', 'nora.flint', 'zoe.vale',
  'alex.stone', 'bella.moon', 'casper.ink', 'diana.rose', 'erik.steel', 'freya.wolf', 'gunnar.frost', 'hilda.storm', 'ivan.dark', 'jade.light',
  'kai.shadow', 'lara.fire', 'mason.river', 'nina.star', 'oscar.wind', 'pia.ocean', 'quinn.forest', 'ruby.sky', 'sage.mountain', 'tara.dawn',
  'ulrich.night', 'vera.sun', 'wade.earth', 'xara.moon', 'yuki.snow', 'zara.rain', 'aria.flame', 'blake.storm', 'cora.mist', 'dexter.wave',
  'elena.tide', 'felix.rock', 'gia.cloud', 'hugo.star', 'ivy.leaf', 'jasper.stone', 'kira.wind', 'liam.fire', 'maya.earth', 'nico.sky',
  'olive.rain', 'phoenix.sun', 'quinn.moon', 'raven.night', 'sage.dawn', 'titan.storm', 'uma.star', 'viktor.fire', 'willow.mist', 'xander.wave',
  'yara.light', 'zane.dark', 'aurora.flame', 'blaze.storm', 'crystal.ice', 'drake.fire', 'ember.moon', 'frost.star', 'glacier.wind', 'haven.rain',
  'iris.dawn', 'jupiter.sun', 'koda.moon', 'luna.star', 'mars.fire', 'nova.light', 'orion.dark', 'polaris.sky', 'quasar.storm', 'rigel.wave',
  'sirius.sun', 'titan.moon', 'ursa.star', 'vega.light', 'wolf.storm', 'xena.fire', 'yara.moon', 'zeus.star', 'alpha.dawn', 'beta.night',
  'gamma.sun', 'delta.moon', 'epsilon.star', 'zeta.light', 'eta.storm', 'theta.fire', 'iota.moon', 'kappa.star', 'lambda.dawn', 'mu.night'
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

    // Independent flags (not mutually exclusive)
    const doesBlackAndGray = Math.random() < (styles.includes('blackwork') ? 0.8 : 0.35);
    const doesColor = Math.random() < 0.7; // can be true even if black & gray is true

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
        beginner: Math.random() < 0.2,
        blackAndGray: doesBlackAndGray,
        color: doesColor,
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
