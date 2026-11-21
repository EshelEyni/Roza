import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import type { ConnectionInfo } from "../../../shared/types/stagingRoom";

export interface DbConfig {
  url: string;
  dbName: string;
  source: string;
}

const parseEnv = (file: string) => (fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {});

/**
 * DB settings come from roza-publish/.env, falling back to Roza's backend .env
 * (ROZA_BACKEND_ENV, default ..\Roza\backend\.env). Secrets are never copied.
 */
export function loadDbConfig(root: string): DbConfig {
  const local = parseEnv(path.join(root, ".env"));
  if (local.DB_URL)
    return { url: local.DB_URL, dbName: local.PROD_DB_NAME || "roza_prod", source: ".env (roza-publish)" };
  const rozaEnv = local.ROZA_BACKEND_ENV || path.resolve(root, "..", "Roza", "backend", ".env");
  const roza = parseEnv(rozaEnv);
  if (roza.DB_URL && roza.PROD_DB_NAME) return { url: roza.DB_URL, dbName: roza.PROD_DB_NAME, source: rozaEnv };
  throw new Error(
    `No database settings found. Add DB_URL and PROD_DB_NAME to roza-publish/.env, or check ${rozaEnv}.`,
  );
}

/** Host part of a Mongo URL with credentials stripped, for display. */
export function maskHost(url: string): string {
  const afterScheme = url.replace(/^mongodb(\+srv)?:\/\//, "");
  const afterCreds = afterScheme.includes("@") ? afterScheme.slice(afterScheme.lastIndexOf("@") + 1) : afterScheme;
  return afterCreds.split(/[/?]/)[0];
}

export function connectionInfo(root: string): ConnectionInfo {
  try {
    const cfg = loadDbConfig(root);
    return { configured: true, source: cfg.source, dbName: cfg.dbName, host: maskHost(cfg.url) };
  } catch (e) {
    return { configured: false, source: "", error: (e as Error).message };
  }
}
