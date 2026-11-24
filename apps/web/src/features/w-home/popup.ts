/**
 * Notice popup layer — mounted once in the root layout (`src/app/layout.tsx`) so popups follow
 * their target pages across the whole site. Kept as its own entry so the layout does not pull in
 * the home page modules.
 */
export { NoticePopupHost } from './components/popup/NoticePopupHost';
export { popupPageForPath } from './lib/popup';
