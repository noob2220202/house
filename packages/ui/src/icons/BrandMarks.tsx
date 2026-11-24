import type { SVGProps } from 'react';

type MarkProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };
const base = (size: number) =>
  ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
    focusable: false,
  }) as const;

/** 카카오 말풍선 심볼 (#191600 on #FEE500). */
export function KakaoMark({ size = 22, ...rest }: MarkProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        fill="#191600"
        d="M12 4C7 4 3 7.2 3 11.1c0 2.5 1.6 4.7 4.1 5.9l-.9 3.3c-.1.3.2.5.5.3l3.9-2.6c.5.1.9.1 1.4.1 5 0 9-3.2 9-7.1S17 4 12 4z"
      />
    </svg>
  );
}

/** 네이버 N — green tile variant (`tile`) or white N for a green button (`white`). */
export function NaverMark({
  size = 22,
  variant = 'tile',
  ...rest
}: MarkProps & { variant?: 'tile' | 'white' }) {
  return (
    <svg {...base(size)} {...rest}>
      {variant === 'tile' && <rect width="24" height="24" rx="5" fill="#03C75A" />}
      <path fill="#FFFFFF" d="M14.2 12.4 9.6 6H6.5v12h3.3v-6.4l4.6 6.4h3.1V6h-3.3z" />
    </svg>
  );
}

/** Google "G" 4-colour mark. */
export function GoogleMark({ size = 22, ...rest }: MarkProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.3-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"
      />
      <path
        fill="#FBBC04"
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.6z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z"
      />
    </svg>
  );
}
