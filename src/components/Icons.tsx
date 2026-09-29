/** Small stroke icons (no icon font, no emoji). All inherit currentColor. */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconCross = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconBack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const IconNext = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);
export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);
export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Svg>
);
export const IconAuto = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v16" />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 20v-4h-4" />
  </Svg>
);
export const IconTimer = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5M9 2h6" />
  </Svg>
);
export const IconBulb = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Svg>
);
export const IconChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
export const IconFlame = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.3 2.4-5.2 3.6-7.8.6 1.6 1.4 2.6 2.4 3.2C11.9 7.4 13 5 15.5 3c-.3 2.8.8 4.6 2 6.4 1 1.5 1.5 3 1.5 4.9C19 18.3 16 21 12 21z" />
  </Svg>
);
export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  </Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);
export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
);

/** Mode glyphs for the home screen. */
export const ModeGlyph = ({ mode, size = 28 }: { mode: string; size?: number }) => {
  switch (mode) {
    case 'map':
      return (
        <Svg size={size} strokeWidth={1.6}>
          <path d="M2 14h20" />
          <path d="M6 14V8M13 14V10M18 14V6" />
          <circle cx="6" cy="7" r="1.6" />
          <circle cx="13" cy="9" r="1.6" />
          <circle cx="18" cy="5" r="1.6" />
          <path d="M2 18h4M8 18h5M15 18h7" strokeDasharray="0" />
        </Svg>
      );
    case 'ends':
      return (
        <Svg size={size} strokeWidth={1.6}>
          <path d="M2 9h9V9M2 15h13" />
          <path d="M22 9h-7M22 15h-3" />
          <path d="M11 9v-2M15 15v2" />
        </Svg>
      );
    case 'pcr':
      return (
        <Svg size={size} strokeWidth={1.6}>
          <path d="M3 18c3 0 3-12 6-12s3 12 6 12 3-12 6-12" />
        </Svg>
      );
    case 'gel':
      return (
        <Svg size={size} strokeWidth={1.6}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M6 7h4M14 7h4M6 11h4M14 13h4M6 15h4M14 17h4" />
        </Svg>
      );
    case 'num':
      return (
        <Svg size={size} strokeWidth={1.6}>
          <path d="M4 17l4-10 4 10M5.5 13.5h5" />
          <path d="M15 8h5M17.5 5.5v5M15 16h5" />
        </Svg>
      );
    default:
      return (
        <Svg size={size} strokeWidth={1.6}>
          <path d="M4 12l4 4 8-9" />
          <path d="M14 17l6-6M20 17l-6-6" />
        </Svg>
      );
  }
};
