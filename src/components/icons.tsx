import type { SVGProps } from "react";

/**
 * A small, consistent icon set drawn on a 24×24 grid with a 1.75 stroke, so
 * every glyph in the product shares one weight and optical size. Icons are
 * decorative: they always sit beside a text label, never replace one.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

/* ── the three streams ─────────────────────────────────────────────────── */

export function MealIcon(props: IconProps) {
  // Fork and knife.
  return (
    <Svg {...props}>
      <path d="M6 3v6a2.5 2.5 0 0 0 5 0V3" />
      <path d="M8.5 9v12" />
      <path d="M17.5 3c-1.4 1.3-2 3-2 5s.6 2.8 2 3v10" />
    </Svg>
  );
}

export function WaterIcon(props: IconProps) {
  // Droplet.
  return (
    <Svg {...props}>
      <path d="M12 3.2c3.1 3 5.5 5.7 5.5 8.6a5.5 5.5 0 0 1-11 0c0-2.9 2.4-5.6 5.5-8.6Z" />
    </Svg>
  );
}

export function MovementIcon(props: IconProps) {
  // Dumbbell.
  return (
    <Svg {...props}>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </Svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 9a6 6 0 1 0-12 0c0 4-1.5 5.3-1.5 5.3h15S18 13 18 9Z" />
      <path d="M10.3 18a2 2 0 0 0 3.4 0" />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

/* ── actions & status ──────────────────────────────────────────────────── */

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
  );
}

export function HalfIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
    </Svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.2 3.5h3l1.5 3.8-2 1.4a11 11 0 0 0 5.6 5.6l1.4-2 3.8 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.2 5.7a2 2 0 0 1 2-2.2Z" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

/* ── landing-page steps ────────────────────────────────────────────────── */

export function UserIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15 9-1.7 4.3L9 15l1.7-4.3L15 9Z" />
    </Svg>
  );
}

export function ChecklistIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3.5 7 2 2 3-3.5M3.5 16l2 2 3-3.5" />
      <path d="M12 7h8.5M12 17h8.5" />
    </Svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 0 0-14-4.5L4 8.5" />
      <path d="M4 13a8 8 0 0 0 14 4.5l2-2" />
      <path d="M4 4.5v4h4M20 19.5v-4h-4" />
    </Svg>
  );
}

export const STREAM_ICONS = {
  MEAL: MealIcon,
  WATER: WaterIcon,
  EXERCISE: MovementIcon,
} as const;
