import "@fastify/jwt";
import type { Role } from "@lk/shared";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      sub: string;
      role: Role;
      sid: string;
      mfa: boolean;
    };
  }
}


