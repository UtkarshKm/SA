import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { toNodeHandler } from "better-auth/node";
import { getMongoDb } from "./db.js";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Add it to your environment or .env file.`);
  }

  return value;
}

function getTrustedOrigins() {
  const baseUrl = getRequiredEnv("BETTER_AUTH_URL");
  const origins = new Set([new URL(baseUrl).origin]);
  const rawTrustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS || "";

  for (const item of rawTrustedOrigins.split(",")) {
    const origin = item.trim();
    if (origin) {
      origins.add(origin);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3001");
  }

  return [...origins];
}

export const auth = betterAuth({
  database: mongodbAdapter(getMongoDb()),
  baseURL: getRequiredEnv("BETTER_AUTH_URL"),
  secret: getRequiredEnv("BETTER_AUTH_SECRET"),
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/api/auth/sign-in/email": {
        window: 60,
        max: 5
      },
      "/api/auth/sign-up/email": {
        window: 60,
        max: 3
      }
    }
  },
  advanced: {
    disableCSRFCheck: false,
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      sameSite: "lax"
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"]
    }
  }
});

export const authHandler = toNodeHandler(auth);
