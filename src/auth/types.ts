export interface JwtPayload {
  sub: string;
  role: string;
  name?: string;
  avatar?: string;
}

export type User = JwtPayload;
