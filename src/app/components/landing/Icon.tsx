import type { CSSProperties } from 'react';

type IconName =
  | 'mic' | 'hand' | 'arrow-rl' | 'sparkle' | 'check' | 'play' | 'pause'
  | 'cc' | 'cam' | 'globe' | 'kbd' | 'eye' | 'bolt' | 'shield' | 'cards'
  | 'arrow' | 'chev' | 'github' | 'q';

interface IconProps {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}

export function Icon({ name, size = 18, style }: IconProps) {
  const s = size;
  const common = {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
  };
  switch (name) {
    case 'mic':
      return (<svg {...common}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>);
    case 'hand':
      return (<svg {...common}><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1.2a4 4 0 0 1-3.6-2.2L5 14a1.4 1.4 0 0 1 2.4-1.4L9 14V7a1.5 1.5 0 0 1 3 0"/></svg>);
    case 'arrow-rl':
      return (<svg {...common}><path d="M3 8h14"/><path d="M14 5l3 3-3 3"/><path d="M21 16H7"/><path d="M10 19l-3-3 3-3"/></svg>);
    case 'sparkle':
      return (<svg {...common}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>);
    case 'check':
      return (<svg {...common}><path d="M4 12l5 5L20 6"/></svg>);
    case 'play':
      return (<svg {...common}><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>);
    case 'pause':
      return (<svg {...common}><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>);
    case 'cc':
      return (<svg {...common}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M9 11a2 2 0 1 0 0 2"/><path d="M15 11a2 2 0 1 0 0 2"/></svg>);
    case 'cam':
      return (<svg {...common}><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2"/></svg>);
    case 'globe':
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>);
    case 'kbd':
      return (<svg {...common}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>);
    case 'eye':
      return (<svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>);
    case 'bolt':
      return (<svg {...common}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" stroke="none"/></svg>);
    case 'shield':
      return (<svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>);
    case 'cards':
      return (<svg {...common}><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h14v14"/></svg>);
    case 'arrow':
      return (<svg {...common}><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>);
    case 'chev':
      return (<svg {...common}><path d="M6 9l6 6 6-6"/></svg>);
    case 'github':
      return (<svg {...common}><path d="M9 19c-4 1.2-4-2-6-2.5M15 21v-3.5a3 3 0 0 0-.8-2.2c2.8-.3 5.8-1.4 5.8-6.3a4.9 4.9 0 0 0-1.4-3.4 4.6 4.6 0 0 0-.1-3.4S16.6 1.8 14 3.6a12 12 0 0 0-6 0c-2.6-1.8-3.5-1.4-3.5-1.4a4.6 4.6 0 0 0-.1 3.4A4.9 4.9 0 0 0 3 9c0 4.9 3 6 5.7 6.3-.4.4-.7 1-.8 1.7L8 21"/></svg>);
    case 'q':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
          <circle cx="12" cy="12" r="9" stroke="url(#qg)" strokeWidth="2"/>
          <path d="M15 15l3 3" stroke="url(#qg)" strokeWidth="2" strokeLinecap="round"/>
          <defs>
            <linearGradient id="qg" x1="0" y1="0" x2="24" y2="24">
              <stop stopColor="var(--accent)"/>
              <stop offset="1" stopColor="var(--warm)"/>
            </linearGradient>
          </defs>
        </svg>
      );
    default:
      return null;
  }
}
