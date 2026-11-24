// Ported from design/drafts/project/Main.dc.html (.hmap-svg) — stylized Suncheon map for the home hero.
// Decorative only; district chips are positioned over it (see ../hero/regions.ts).
import type { SVGProps } from 'react';

export const HERO_MAP_VIEWBOX = { width: 600, height: 540 } as const;

export function HeroMapArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 600 540"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect width="600" height="540" fill="#F3F5F8" />
      <path d="M30 222 C56 192 132 196 156 236 S152 300 108 312 S20 290 30 222z" fill="#E1EEE5" />
      <path d="M0 30 C40 16 88 30 92 70 S58 120 22 118 L0 116z" fill="#E1EEE5" />
      <path
        d="M368 158 C380 124 478 120 494 160 S474 214 430 216 S354 194 368 158z"
        fill="#E1EEE5"
      />
      <path
        d="M390 162 C400 140 462 138 472 162 S454 196 432 196 S382 186 390 162z"
        fill="#D1E2F7"
      />
      <g fill="#E7EAEF">
        <rect x="154" y="24" width="15" height="8" rx="2" />
        <rect x="154" y="76" width="14" height="8" rx="2" />
        <rect x="154" y="102" width="15" height="12" rx="2" />
        <rect x="154" y="154" width="16" height="8" rx="2" />
        <rect x="154" y="180" width="11" height="15" rx="2" />
        <rect x="180" y="50" width="14" height="9" rx="2" />
        <rect x="180" y="102" width="20" height="8" rx="2" />
        <rect x="180" y="128" width="19" height="9" rx="2" />
        <rect x="180" y="154" width="15" height="15" rx="2" />
        <rect x="206" y="50" width="13" height="10" rx="2" />
        <rect x="206" y="76" width="12" height="9" rx="2" />
        <rect x="206" y="102" width="12" height="11" rx="2" />
        <rect x="206" y="154" width="11" height="18" rx="2" />
        <rect x="206" y="180" width="11" height="14" rx="2" />
        <rect x="232" y="24" width="17" height="15" rx="2" />
        <rect x="232" y="102" width="9" height="8" rx="2" />
        <rect x="232" y="128" width="16" height="15" rx="2" />
        <rect x="232" y="154" width="12" height="12" rx="2" />
        <rect x="232" y="180" width="13" height="17" rx="2" />
        <rect x="258" y="24" width="13" height="10" rx="2" />
        <rect x="258" y="76" width="10" height="10" rx="2" />
        <rect x="258" y="102" width="18" height="19" rx="2" />
        <rect x="258" y="128" width="18" height="16" rx="2" />
        <rect x="258" y="154" width="15" height="7" rx="2" />
        <rect x="258" y="180" width="12" height="10" rx="2" />
        <rect x="284" y="24" width="16" height="16" rx="2" />
        <rect x="284" y="76" width="8" height="11" rx="2" />
        <rect x="284" y="102" width="13" height="8" rx="2" />
        <rect x="284" y="128" width="13" height="17" rx="2" />
        <rect x="284" y="154" width="14" height="9" rx="2" />
        <rect x="284" y="180" width="19" height="10" rx="2" />
        <rect x="310" y="76" width="16" height="15" rx="2" />
        <rect x="310" y="102" width="11" height="17" rx="2" />
        <rect x="336" y="50" width="18" height="17" rx="2" />
        <rect x="336" y="102" width="9" height="10" rx="2" />
        <rect x="336" y="128" width="9" height="11" rx="2" />
        <rect x="154" y="218" width="10" height="9" rx="2" />
        <rect x="154" y="270" width="9" height="12" rx="2" />
        <rect x="154" y="322" width="13" height="7" rx="2" />
        <rect x="180" y="218" width="13" height="16" rx="2" />
        <rect x="180" y="244" width="19" height="16" rx="2" />
        <rect x="180" y="270" width="11" height="11" rx="2" />
        <rect x="180" y="322" width="9" height="8" rx="2" />
        <rect x="206" y="244" width="8" height="14" rx="2" />
        <rect x="206" y="270" width="13" height="13" rx="2" />
        <rect x="206" y="296" width="14" height="12" rx="2" />
        <rect x="232" y="218" width="16" height="13" rx="2" />
        <rect x="232" y="244" width="16" height="13" rx="2" />
        <rect x="232" y="270" width="19" height="12" rx="2" />
        <rect x="232" y="296" width="16" height="16" rx="2" />
        <rect x="232" y="322" width="15" height="19" rx="2" />
        <rect x="258" y="218" width="18" height="12" rx="2" />
        <rect x="258" y="270" width="15" height="15" rx="2" />
        <rect x="258" y="296" width="17" height="16" rx="2" />
        <rect x="258" y="322" width="13" height="18" rx="2" />
        <rect x="284" y="218" width="9" height="11" rx="2" />
        <rect x="284" y="244" width="20" height="15" rx="2" />
        <rect x="284" y="296" width="10" height="9" rx="2" />
        <rect x="284" y="322" width="12" height="7" rx="2" />
        <rect x="310" y="218" width="14" height="7" rx="2" />
        <rect x="310" y="244" width="10" height="15" rx="2" />
        <rect x="310" y="296" width="12" height="18" rx="2" />
        <rect x="310" y="322" width="13" height="17" rx="2" />
        <rect x="336" y="244" width="13" height="18" rx="2" />
        <rect x="336" y="270" width="9" height="9" rx="2" />
        <rect x="336" y="296" width="11" height="12" rx="2" />
        <rect x="336" y="322" width="12" height="7" rx="2" />
        <rect x="402" y="246" width="14" height="15" rx="2" />
        <rect x="402" y="274" width="9" height="13" rx="2" />
        <rect x="402" y="330" width="8" height="9" rx="2" />
        <rect x="430" y="218" width="20" height="7" rx="2" />
        <rect x="430" y="246" width="12" height="12" rx="2" />
        <rect x="430" y="302" width="15" height="10" rx="2" />
        <rect x="430" y="330" width="20" height="20" rx="2" />
        <rect x="458" y="218" width="21" height="18" rx="2" />
        <rect x="458" y="246" width="9" height="10" rx="2" />
        <rect x="458" y="302" width="16" height="21" rx="2" />
        <rect x="486" y="218" width="12" height="9" rx="2" />
        <rect x="486" y="246" width="17" height="18" rx="2" />
        <rect x="486" y="274" width="12" height="15" rx="2" />
        <rect x="486" y="330" width="21" height="16" rx="2" />
        <rect x="514" y="218" width="13" height="15" rx="2" />
        <rect x="514" y="246" width="10" height="12" rx="2" />
        <rect x="514" y="274" width="18" height="14" rx="2" />
        <rect x="514" y="302" width="17" height="12" rx="2" />
        <rect x="542" y="246" width="21" height="18" rx="2" />
        <rect x="542" y="274" width="14" height="19" rx="2" />
        <rect x="542" y="302" width="9" height="19" rx="2" />
        <rect x="542" y="330" width="11" height="10" rx="2" />
        <rect x="570" y="246" width="13" height="21" rx="2" />
        <rect x="570" y="274" width="17" height="15" rx="2" />
        <rect x="570" y="330" width="10" height="14" rx="2" />
        <rect x="474" y="24" width="11" height="13" rx="2" />
        <rect x="474" y="50" width="11" height="14" rx="2" />
        <rect x="474" y="76" width="14" height="8" rx="2" />
        <rect x="474" y="128" width="14" height="7" rx="2" />
        <rect x="500" y="24" width="9" height="8" rx="2" />
        <rect x="500" y="50" width="13" height="15" rx="2" />
        <rect x="500" y="76" width="18" height="9" rx="2" />
        <rect x="500" y="128" width="20" height="17" rx="2" />
        <rect x="526" y="24" width="15" height="18" rx="2" />
        <rect x="526" y="76" width="15" height="8" rx="2" />
        <rect x="526" y="102" width="12" height="11" rx="2" />
        <rect x="526" y="128" width="15" height="9" rx="2" />
        <rect x="552" y="24" width="16" height="7" rx="2" />
        <rect x="552" y="102" width="9" height="10" rx="2" />
        <rect x="552" y="128" width="14" height="13" rx="2" />
        <rect x="578" y="24" width="9" height="11" rx="2" />
        <rect x="578" y="128" width="9" height="11" rx="2" />
        <rect x="22" y="390" width="12" height="17" rx="2" />
        <rect x="22" y="416" width="14" height="18" rx="2" />
        <rect x="22" y="442" width="12" height="16" rx="2" />
        <rect x="22" y="468" width="11" height="16" rx="2" />
        <rect x="48" y="390" width="13" height="13" rx="2" />
        <rect x="48" y="416" width="9" height="13" rx="2" />
        <rect x="48" y="442" width="11" height="16" rx="2" />
        <rect x="48" y="468" width="10" height="16" rx="2" />
        <rect x="74" y="390" width="17" height="8" rx="2" />
        <rect x="74" y="416" width="11" height="7" rx="2" />
        <rect x="74" y="442" width="17" height="11" rx="2" />
        <rect x="100" y="364" width="13" height="14" rx="2" />
        <rect x="100" y="416" width="13" height="15" rx="2" />
        <rect x="100" y="442" width="9" height="19" rx="2" />
        <rect x="100" y="468" width="19" height="10" rx="2" />
        <rect x="126" y="364" width="13" height="18" rx="2" />
        <rect x="126" y="390" width="18" height="12" rx="2" />
        <rect x="126" y="416" width="17" height="9" rx="2" />
        <rect x="126" y="442" width="15" height="14" rx="2" />
        <rect x="126" y="468" width="16" height="8" rx="2" />
        <rect x="152" y="364" width="13" height="8" rx="2" />
        <rect x="152" y="390" width="11" height="7" rx="2" />
        <rect x="152" y="416" width="15" height="10" rx="2" />
        <rect x="152" y="468" width="11" height="16" rx="2" />
        <rect x="178" y="364" width="13" height="17" rx="2" />
        <rect x="178" y="468" width="18" height="15" rx="2" />
        <rect x="204" y="468" width="8" height="7" rx="2" />
        <rect x="424" y="394" width="14" height="8" rx="2" />
        <rect x="424" y="442" width="9" height="12" rx="2" />
        <rect x="448" y="394" width="15" height="14" rx="2" />
        <rect x="448" y="418" width="11" height="16" rx="2" />
        <rect x="448" y="442" width="15" height="7" rx="2" />
        <rect x="472" y="394" width="13" height="15" rx="2" />
        <rect x="472" y="418" width="16" height="17" rx="2" />
        <rect x="472" y="442" width="10" height="9" rx="2" />
        <rect x="496" y="370" width="11" height="15" rx="2" />
        <rect x="496" y="394" width="12" height="9" rx="2" />
        <rect x="496" y="418" width="17" height="16" rx="2" />
        <rect x="520" y="370" width="11" height="15" rx="2" />
        <rect x="520" y="394" width="16" height="9" rx="2" />
        <rect x="520" y="418" width="15" height="13" rx="2" />
        <rect x="520" y="442" width="14" height="10" rx="2" />
        <rect x="544" y="370" width="16" height="15" rx="2" />
        <rect x="544" y="394" width="15" height="13" rx="2" />
        <rect x="544" y="442" width="18" height="8" rx="2" />
        <rect x="568" y="370" width="12" height="11" rx="2" />
        <rect x="568" y="418" width="11" height="9" rx="2" />
      </g>
      <path d="M338 470 C372 446 430 446 452 470 S462 530 446 540 H330z" fill="#E1EEE5" />
      <path d="M0 540 V502 C80 488 170 508 250 524 S320 540 330 540z" fill="#D9E7F8" />
      <path d="M600 496 C560 504 520 520 498 540 H600z" fill="#D9E7F8" />
      <path
        d="M262 0 C250 90 292 150 278 236 S222 360 244 430 S300 500 312 540"
        fill="none"
        stroke="#E3EFE6"
        strokeWidth="34"
      />
      <path
        d="M262 0 C250 90 292 150 278 236 S222 360 244 430 S300 500 312 540"
        fill="none"
        stroke="#C9DCF5"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <g fill="none" strokeLinecap="round">
        <g stroke="#E0E5EC" strokeWidth="7">
          <path d="M206 0 C214 80 210 140 218 200" />
          <path d="M420 196 C444 120 476 60 520 0" />
          <path d="M380 262 H600" />
          <path d="M0 450 C120 440 220 456 300 446" />
          <path d="M440 430 C500 420 560 424 600 430" />
          <path d="M226 344 C236 410 228 470 238 540" />
          <path d="M0 110 C60 104 100 112 134 108" />
        </g>
        <g stroke="#FFFFFF" strokeWidth="4.5">
          <path d="M206 0 C214 80 210 140 218 200" />
          <path d="M420 196 C444 120 476 60 520 0" />
          <path d="M380 262 H600" />
          <path d="M0 450 C120 440 220 456 300 446" />
          <path d="M440 430 C500 420 560 424 600 430" />
          <path d="M226 344 C236 410 228 470 238 540" />
          <path d="M0 110 C60 104 100 112 134 108" />
        </g>
        <g stroke="#DCE2EA" strokeWidth="12">
          <path d="M0 200 C140 190 300 208 420 196 S560 184 600 190" />
          <path d="M0 344 C160 334 300 354 440 340 S560 326 600 332" />
          <path d="M372 0 C366 110 388 200 380 320 S372 440 386 540" />
          <path d="M130 0 C144 120 138 220 122 330 S106 460 110 540" />
          <path d="M600 262 C520 312 470 392 440 540" />
        </g>
        <g stroke="#FFFFFF" strokeWidth="9">
          <path d="M0 200 C140 190 300 208 420 196 S560 184 600 190" />
          <path d="M0 344 C160 334 300 354 440 340 S560 326 600 332" />
          <path d="M372 0 C366 110 388 200 380 320 S372 440 386 540" />
          <path d="M130 0 C144 120 138 220 122 330 S106 460 110 540" />
          <path d="M600 262 C520 312 470 392 440 540" />
        </g>
      </g>
      <path
        d="M600 120 C540 200 440 270 330 320 S120 400 0 430"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
      />
      <path
        d="M600 120 C540 200 440 270 330 320 S120 400 0 430"
        fill="none"
        stroke="#8C97A8"
        strokeWidth="2.4"
        strokeDasharray="8 6"
      />
      <g fill="none" stroke="#B8C2CF" strokeWidth="1.3" strokeDasharray="4 5">
        <path d="M0 168 C100 160 210 172 340 160" />
        <path d="M340 0 C334 120 350 220 340 340" />
        <path d="M340 340 C420 350 500 356 600 348" />
        <path d="M188 340 C182 410 194 470 188 540" />
        <path d="M480 0 C478 80 488 150 480 200 S560 210 600 206" />
      </g>
      <path
        d="M410 360 C460 344 550 348 588 368 L594 452 C548 474 466 476 420 458 Z"
        fill="rgba(29,79,242,.08)"
        stroke="#1D4FF2"
        strokeWidth="2"
        strokeDasharray="7 5"
      />
      <circle cx="330" cy="320" r="6" fill="#FFFFFF" stroke="#1F2836" strokeWidth="2.6" />
    </svg>
  );
}
