import { Logo as UiLogo, type LogoProps as UiLogoProps } from '@house/ui';
import Link from 'next/link';
import { BRAND } from '@/config/brand';

export type LogoProps = Omit<UiLogoProps, 'name' | 'linkAs'> & { href?: string };

/** Brand lockup wired to the brand config. Links to the dashboard by default. */
export function Logo({ href = '/', ...props }: LogoProps) {
  return <UiLogo name={BRAND.name} href={href} linkAs={Link} {...props} />;
}
