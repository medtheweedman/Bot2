import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";

const COOKIE_NAME = "creator_studio_access";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

function getSigningKey(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

export function hasConfiguredAccessCode(): boolean {
  const code = process.env.WHATSAPP_ACCESS_CODE;
  return !!code && code.length >= MIN_SECRET_LENGTH && !!getSigningKey();
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function isAccessSessionValid(req: Request): boolean {
  const token = req.cookies?.[COOKIE_NAME];
  const key = getSigningKey();
  if (typeof token !== "string" || !key) return false;

  const [payload, suppliedSignature, ...extra] = token.split(".");
  if (!payload || !suppliedSignature || extra.length > 0) return false;

  const expected = Buffer.from(sign(payload, key), "base64url");
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      expiresAt?: unknown;
      nonce?: unknown;
    };
    return (
      typeof decoded.expiresAt === "number" &&
      decoded.expiresAt > Date.now() &&
      typeof decoded.nonce === "string" &&
      decoded.nonce.length >= 16
    );
  } catch {
    return false;
  }
}

export function issueAccessSession(): {
  cookieName: string;
  cookieValue: string;
  maxAge: number;
} {
  const key = getSigningKey();
  if (!key) throw new Error("The session signing secret is not configured.");

  const payload = Buffer.from(
    JSON.stringify({
      expiresAt: Date.now() + SESSION_TTL_MS,
      nonce: randomBytes(18).toString("base64url"),
    }),
  ).toString("base64url");

  return {
    cookieName: COOKIE_NAME,
    cookieValue: `${payload}.${sign(payload, key)}`,
    maxAge: SESSION_TTL_MS,
  };
}

export const requireAccess: RequestHandler = (req, res, next) => {
  if (!isAccessSessionValid(req)) {
    res.status(401).json({ error: "Enter the workspace access code to continue." });
    return;
  }
  next();
};

export const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};