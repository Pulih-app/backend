export type UserRole = "patient" | "psychologist" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
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

export type UserPayload = {
  id: string;
  email: string;
  nickname: string | null;
  recovery_reason: string | null;
  daily_checkin_time: string | null;
  porn_free_goal: number | null;
  onboarding_completed: boolean;
};

export type SessionPayload = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
};

export type AuthResult = {
  user: UserPayload;
  session: SessionPayload;
};
