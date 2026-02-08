/**
 * Manual Jest mock for @prisma/client.
 * Needed because Prisma 7 requires Node 20+ to generate the client,
 * but tests run on whichever Node version is installed locally.
 */

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
  toFixed(digits: number) {
    return this.val.toFixed(digits);
  }
}

export const Prisma = {
  Decimal: FakeDecimal,
};

export class PrismaClient {}

export type User = {
  id: string;
  email: string;
  googleId: string;
  name: string | null;
  avatar: string | null;
  role: string;
  createdAt: Date;
};
