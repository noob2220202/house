import { useMemo } from 'react';
import { encodeQr, qrPath } from '../../lib/qr';

export interface QrCodeProps {
  /** Text to encode (the otpauth:// URI). */
  value: string;
  /** Accessible description — never the secret itself. */
  label: string;
  className?: string;
}

const QUIET = 2;

/** QR code rendered locally as inline SVG (the TOTP secret never leaves the browser). */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { d, size } = useMemo(() => {
    try {
      const modules = encodeQr(value);
      return { d: qrPath(modules, QUIET), size: modules.length + QUIET * 2 };
    } catch {
      return { d: '', size: 0 };
    }
  }, [value]);
  if (!d) return null;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="var(--surface)" />
      <path d={d} fill="var(--text)" />
    </svg>
  );
}
