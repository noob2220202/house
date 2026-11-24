import { AUTH_PROVIDER_LABEL, type AuthProvider } from '@house/shared';
import { ProviderTile, type ProviderTileProps } from '@house/ui';
import u from './users.module.css';

/** The login providers linked to a member, as a row of @house/ui provider tiles. */
export function ProviderMarks({
  providers,
  size = 'md',
}: {
  providers: readonly AuthProvider[];
  /** `md` in the table, `sm` inside the tag row of a mobile card. */
  size?: ProviderTileProps['size'];
}) {
  if (providers.length === 0) return <span className={u.noProvider}>–</span>;
  return (
    <span className={u.providers}>
      {providers.map((p) => (
        <ProviderTile key={p} provider={p} size={size} label={AUTH_PROVIDER_LABEL[p]} />
      ))}
    </span>
  );
}
