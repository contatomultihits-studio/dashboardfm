import type { RoleName } from "@prisma/client";
export const roles: RoleName[] = ["ADMIN", "PRODUCAO", "ANALISTA", "PUBLICO"];
export function currentRole(): RoleName { return (process.env.APP_ROLE as RoleName) || "ADMIN"; }
export function canAccessSensitive(role = currentRole()) { return role === "ADMIN" || role === "PRODUCAO"; }
export function maskSensitive(value?: string | null) { if (!value) return "—"; return value.replace(/.(?=.{4})/g, "•"); }
