/** Breakpoints of the design system (px). Mobile is `max-width: 720px`. */
export const BREAKPOINTS = { mobile: 720, tablet: 1080 } as const;
export const MEDIA = {
  mobile: `(max-width: ${BREAKPOINTS.mobile}px)`,
  desktop: `(min-width: ${BREAKPOINTS.mobile + 1}px)`,
  wide: `(min-width: ${BREAKPOINTS.tablet + 1}px)`,
} as const;
