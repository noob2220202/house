/** Routes of the customer side of 문의 (MY > 문의 내역; see features/w-me/routes.ts for the menu). */
export const ME_INQUIRY_ROUTES = {
  list: '/me/inquiries',
  detail: (id: string) => `/me/inquiries/${encodeURIComponent(id)}`,
} as const;
