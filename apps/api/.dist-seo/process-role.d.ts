/**
 * Which process this is. Each entry point imports its role module (roles/api.ts, roles/worker.ts)
 * FIRST — before AppModule, whose ConfigModule.forRoot() validates process.env at import time:
 *  - main.ts (HTTP API): JOBS_ENABLED=false — never runs BullMQ processors or registers schedules;
 *    it only enqueues jobs.
 *  - worker.ts: JOBS_ENABLED=true — runs every processor and registers the repeatable jobs.
 * Processors are declared with `autorun: false` and start their worker in onApplicationBootstrap
 * only when JOBS_ENABLED (see processors.spec.ts).
 */
export type ProcessRole = 'api' | 'worker';
export declare function applyProcessRole(role: ProcessRole): void;
