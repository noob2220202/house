'use client';
import { Select } from '@house/ui';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { formatDate } from '@/lib/format';
import type { TermsVersion } from '../api/schemas';

export interface VersionSelectProps {
  /** Path of the document without query, e.g. "/terms/service". */
  basePath: string;
  versions: readonly TermsVersion[];
  /** Version currently shown. */
  value: string;
  /** Version in force (selected when there is no `?version=`). */
  currentVersion: string;
}

/** Version selector of a terms document: navigates to `?version=<v>` (the current one has no query). */
export function VersionSelect({ basePath, versions, value, currentVersion }: VersionSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      label="버전"
      value={value}
      disabled={pending}
      aria-busy={pending || undefined}
      onChange={(e) => {
        const next = e.target.value;
        const href =
          next === currentVersion ? basePath : `${basePath}?version=${encodeURIComponent(next)}`;
        startTransition(() => router.push(href, { scroll: false }));
      }}
      options={versions.map((v) => ({
        value: v.version,
        label: `v${v.version} · ${formatDate(v.effectiveAt)} 시행${v.version === currentVersion ? ' (현재)' : ''}`,
      }))}
    />
  );
}
