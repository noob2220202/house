/**
 * BullMQ root connection. Feature modules call `BullModule.registerQueue({ name: QUEUES.X })`
 * and add `@Processor(QUEUES.X)` workers. Repeatable jobs must be registered only when
 * `JOBS_ENABLED` is true (use `upsertJobScheduler` so registration is idempotent).
 */
export declare class QueueModule {
}
