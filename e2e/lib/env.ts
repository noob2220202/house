import fs from 'node:fs';
import path from 'node:path';

/** Where scripts/e2e-stack.sh keeps logs, uploads, admin.json and storage states. */
export const ROOT = path.resolve(__dirname, '..', '..');
export const STATE_DIR = process.env.E2E_STATE_DIR ?? path.join(ROOT, '.tmp', 'e2e');
export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3200';
export const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:3201';
export const API_ORIGIN = process.env.E2E_API_ORIGIN ?? 'http://127.0.0.1:4100';
export const ADMIN_STORAGE_STATE = path.join(STATE_DIR, 'auth', 'admin.json');
export const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

/** Seeded demo members (apps/api/prisma/seed/demo.ts: `${agencyKey}-owner` / `-staffN`). */
export const SEED = {
  /** 대표 of 신대호수공인중개사사무소 (agency a1), AGENCY_OWNER. */
  ownerA1: 'a1-owner@seed.example.invalid',
  /** 대표 of agency a2, AGENCY_OWNER — used as the co-broker. */
  ownerA2: 'a2-owner@seed.example.invalid',
  /** 소속공인중개사 of a1, AGENT. */
  agentA1: 'a1-staff1@seed.example.invalid',
} as const;

export interface AdminState {
  email: string;
  password: string;
  totpSecret: string;
  recoveryCodes: string[];
  /** Last TOTP time step the API accepted (it refuses a replayed step). */
  lastUsedStep: number;
}

const adminFile = () => path.join(STATE_DIR, 'admin.json');

export function readAdminState(): AdminState {
  const file = adminFile();
  if (!fs.existsSync(file)) {
    throw new Error(`${file} missing — start the stack with scripts/e2e-stack.sh up`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as AdminState;
}

export function recordTotpStep(step: number): void {
  const state = readAdminState();
  state.lastUsedStep = Math.max(state.lastUsedStep, step);
  fs.writeFileSync(adminFile(), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

/** Unique suffix per test run + worker, for names/emails that must not collide. */
export function uniq(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
