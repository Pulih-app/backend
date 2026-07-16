export type UserRole = "patient" | "psychologist" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  status: string;
};

export type AuthContext = {
  user: AuthUser;
};

export type TokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  status: string;
  iat: number;
  exp: number;
};
