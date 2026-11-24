import { ConsentHistoryPanel } from './ConsentHistoryPanel';
import { LinkedAccountsPanel } from './LinkedAccountsPanel';
import { SessionPanel } from './SessionPanel';
import { WithdrawEntry } from './WithdrawEntry';
import styles from './account.module.css';

/** Body of /me/account (계정 설정): login accounts, consent history, sessions, withdrawal entry. */
export function AccountSettings() {
  return (
    <div className={styles.view}>
      <LinkedAccountsPanel />
      <ConsentHistoryPanel />
      <SessionPanel />
      <WithdrawEntry />
    </div>
  );
}
