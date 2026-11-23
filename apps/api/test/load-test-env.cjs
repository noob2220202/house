// Resolves the env of one e2e module: test/env/common.env + test/env/<module>.env.
// Used by run-e2e.mjs / prepare-test-dbs.mjs (to migrate the module DB) and by jest setup.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dotenv = require('dotenv');

const ENV_DIR = path.join(__dirname, 'env');

/** Module names that have an env file (excluding common.env). */
function listModules() {
  return fs
    .readdirSync(ENV_DIR)
    .filter((f) => f.endsWith('.env') && f !== 'common.env')
    .map((f) => f.slice(0, -'.env'.length))
    .sort();
}

/** @param {string} moduleName @returns {Record<string, string>} */
function resolveTestEnv(moduleName) {
  const file = path.join(ENV_DIR, `${moduleName}.env`);
  if (!fs.existsSync(file)) throw new Error(`No e2e env file for module "${moduleName}" (${file})`);
  const env = {
    ...dotenv.parse(fs.readFileSync(path.join(ENV_DIR, 'common.env'))),
    ...dotenv.parse(fs.readFileSync(file)),
  };
  if (!env.DATABASE_URL || !/\/house_test_[a-z_]+(\?|$)/.test(env.DATABASE_URL)) {
    throw new Error(`${moduleName}.env: DATABASE_URL must point at a house_test_<module> database`);
  }
  const redisDb = Number(env.REDIS_DB);
  if (!Number.isInteger(redisDb) || redisDb < 1 || redisDb > 15) {
    throw new Error(`${moduleName}.env: REDIS_DB must be an integer 1..15 (0 is the dev DB)`);
  }
  env.REDIS_URL = `${env.REDIS_HOST_URL ?? 'redis://localhost:6379'}/${redisDb}`;
  const scratch = path.join(os.tmpdir(), 'house-test', moduleName);
  env.UPLOAD_DIR ??= path.join(scratch, 'uploads');
  env.PRIVATE_UPLOAD_DIR ??= path.join(scratch, 'private-uploads');
  env.E2E_MODULE = moduleName;
  return env;
}

module.exports = { listModules, resolveTestEnv };
