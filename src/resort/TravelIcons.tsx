import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function TravelIcon({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

// A pointed Thai chedi, distinct from Hongcun's colonnaded architecture icon.
export function ChiangMaiIcon(props: IconProps) {
  return (
    <TravelIcon {...props}>
      <path d="M12 2v3M12 5c0 3-1.5 5-4 7h8c-2.5-2-4-4-4-7Z" />
      <path d="M8 12c-.6 2-2 3-4 4h16c-2-1-3.4-2-4-4M6 16v4h12v-4M3 21h18" />
    </TravelIcon>
  );
}

// Upright karst peaks and river ripples identify Yangshuo at navigation size.
export function KarstRiverIcon(props: IconProps) {
  return (
    <TravelIcon {...props}>
      <path d="M2 15 5 8q1-2 2 0l2 7 3-11q1-3 2 0l3 11 2-6q1-2 2 0l1 6" />
      <path d="M2 18c3-2 5 2 8 0s5 2 8 0h4M5 22h5m4 0h5" />
    </TravelIcon>
  );
}

export function LandscapeReflectionIcon(props: IconProps) {
  return (
    <TravelIcon {...props}>
      <circle cx="18.5" cy="5" r="2.5" />
      <path d="m2 14 6-10 6 10 3-5 5 5M2 17h20M5 21h4m4 0h6" />
    </TravelIcon>
  );
}

export function ClimbingIcon(props: IconProps) {
  return (
    <TravelIcon {...props}>
      <circle cx="9.5" cy="5" r="2" />
      <path d="m8.5 9 4 1 3-5M8.5 9 5 12H2m8-3 1 6 4 2v4m-4-6-5 2-2 4" />
      <path d="M21 2v6l-2 4 2 4v6" />
    </TravelIcon>
  );
}

export function PingPongIcon(props: IconProps) {
  return (
    <TravelIcon {...props}>
      <path d="M9.7 14.5c-3.5-2.1-3.5-6.1-.4-9.2s7.2-3.4 10-.6 2.5 6.9-.6 10c-2 2-4.8 2.6-7 1.5L7 20.9a1.4 1.4 0 0 1-2-2Z" />
      <path d="m8 10.4 6.5 6.5" />
      <circle cx="3.3" cy="4.7" r="2" />
    </TravelIcon>
  );
}
