/**
 * Routes of the broker inbox (a-inbox). `/agent/requests` and `/agent/requests/[id]` are also
 * listed in `features/a-agency/nav.ts` (sidebar); the notification centre of the console is this
 * group's own path. There is no 문의함 for launch (D5: `/agent/inquiries` only redirects).
 */
export const INBOX_ROUTES = {
  requests: '/agent/requests',
  request: (id: string) => `/agent/requests/${encodeURIComponent(id)}`,
  notifications: '/agent/notifications',
} as const;
