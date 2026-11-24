/**
 * Public surface of the w-auth page group for other groups (my page, broker console …).
 * Everything else under src/features/w-auth is internal.
 */
export { AUTH_ROUTES } from './routes';
export { LinkedAccountsPanel } from './components/account/LinkedAccountsPanel';
export { ConsentHistoryPanel } from './components/account/ConsentHistoryPanel';
export { SessionPanel } from './components/account/SessionPanel';
export { WithdrawEntry } from './components/account/WithdrawEntry';
export { loginPath, signupPath, oauthLoginUrl, oauthLinkUrl, type LoginIntent } from './lib/flow';
export { maskEmail, maskName } from './lib/mask';
export {
  useMyLocation,
  type DevicePosition,
} from './components/location/useMyLocation';
