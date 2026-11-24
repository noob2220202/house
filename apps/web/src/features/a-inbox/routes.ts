/**
 * Routes of the broker inbox (a-inbox). `/agent/requests`, `/agent/requests/[id]` and
 * `/agent/inquiries` are also listed in `features/a-agency/nav.ts` (sidebar); the notification
 * centre of the console is this group's own path.
 */
export const INBOX_ROUTES = {
  requests: '/agent/requests',
  request: (id: string) => `/agent/requests/${encodeURIComponent(id)}`,
  inquiries: '/agent/inquiries',
  inquiry: (id: string) => `/agent/inquiries?id=${encodeURIComponent(id)}`,
  notifications: '/agent/notifications',
} as const;
