import type { SVGProps } from 'react';

/**
 * Storefront illustration shown as the profile cover when an office has no cover photo.
 * Ported 1:1 from design/drafts/project/Agents.dc.html (.od-cover). Decorative.
 */
export function OfficeCoverArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 400 108"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect width="400" height="108" fill="#E8EEFB" />
      <circle cx="128" cy="24" r="11" fill="#F7F0DE" />
      <path d="M0 62 C50 48 100 54 150 50 S250 40 400 52 V108 H0z" fill="#D6E0F4" />
      <path d="M0 72 C50 68 110 70 162 74 V92 H0z" fill="#C9DCF5" />
      <g stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" opacity=".85">
        <path d="M14 79h22M58 83h30M110 79h18M30 87h16" />
      </g>
      <rect x="176" y="14" width="152" height="42" fill="#FFFFFF" />
      <rect x="328" y="14" width="14" height="78" fill="#C9D6EF" />
      <rect x="186" y="21" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="210.4" y="21" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="234.8" y="21" width="17" height="8" rx="1" fill="#E9D7A8" />
      <rect x="259.2" y="21" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="283.6" y="21" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="308" y="21" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="186" y="35" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="210.4" y="35" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="234.8" y="35" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="259.2" y="35" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="283.6" y="35" width="17" height="8" rx="1" fill="#E9D7A8" />
      <rect x="308" y="35" width="17" height="8" rx="1" fill="#A7BAE2" />
      <rect x="172" y="10" width="174" height="4" fill="#0F1B3A" />
      <rect x="176" y="56" width="152" height="14" fill="#0F1B3A" />
      <rect x="186" y="61" width="58" height="4.5" rx="2" fill="#E9D7A8" />
      <rect x="250" y="61" width="18" height="4.5" rx="2" fill="#E9D7A8" opacity=".55" />
      <rect x="306" y="59" width="14" height="8" rx="2" fill="#1D4FF2" />
      <path d="M176 70h152l-5 6H181z" fill="#C9D6EF" />
      <rect x="182" y="76" width="104" height="16" fill="#D9E6F8" />
      <path d="M216 76v16M251 76v16" stroke="#FFFFFF" strokeWidth="2" />
      <rect x="188" y="81" width="16" height="8" rx="1" fill="#FFFFFF" opacity=".7" />
      <rect x="258" y="82" width="20" height="7" rx="1" fill="#FFFFFF" opacity=".7" />
      <rect x="294" y="75" width="28" height="17" fill="#1D4FF2" />
      <path d="M308 75v17" stroke="#0F1B3A" strokeWidth="1.2" opacity=".35" />
      <rect x="0" y="92" width="400" height="16" fill="#DCE2EA" />
      <path d="M0 96h400" stroke="#E7EBF1" strokeWidth="2" />
      <g fill="none" stroke="#C9A960" strokeWidth="1.3" strokeLinecap="round" opacity=".9">
        <path d="M96 92q-2 -8 -3.2 -16" />
        <path d="M92.8 76l-1 -6" strokeWidth="2.6" />
        <path d="M105 92q3 -11.5 4.8 -23" />
        <path d="M109.8 69l1.5 -6" strokeWidth="2.6" />
        <path d="M114 92q-2 -9.5 -3.2 -19" />
        <path d="M110.8 73l-1 -6" strokeWidth="2.6" />
        <path d="M117 92q3 -13 4.8 -26" />
        <path d="M121.8 66l1.5 -6" strokeWidth="2.6" />
        <path d="M126 92q-2 -11 -3.2 -22" />
        <path d="M122.8 70l-1 -6" strokeWidth="2.6" />
        <path d="M135 92q3 -9 4.8 -18" />
        <path d="M139.8 74l1.5 -6" strokeWidth="2.6" />
        <path d="M138 92q-2 -12.5 -3.2 -25" />
        <path d="M134.8 67l-1 -6" strokeWidth="2.6" />
        <path d="M147 92q3 -10.5 4.8 -21" />
        <path d="M151.8 71l1.5 -6" strokeWidth="2.6" />
        <path d="M156 92q-2 -8.5 -3.2 -17" />
        <path d="M152.8 75l-1 -6" strokeWidth="2.6" />
      </g>
      <rect x="159" y="76" width="2" height="15" fill="#7E9F8C" />
      <circle cx="160" cy="76" r="11" fill="#A9CDB8" />
      <rect x="361" y="72" width="2" height="17" fill="#7E9F8C" />
      <circle cx="362" cy="72" r="13" fill="#9CC2AD" />
      <path d="M384 92V50" stroke="#4E5968" strokeWidth="2" />
      <path d="M384 50h-9" stroke="#4E5968" strokeWidth="2" />
      <rect x="370" y="48" width="8" height="4" rx="1" fill="#E9D7A8" />
    </svg>
  );
}
