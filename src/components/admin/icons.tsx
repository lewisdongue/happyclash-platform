/** Small line icons for the Admin Console. They inherit `currentColor`. */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const paths = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  reports: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  videos: <><rect x="3" y="5" width="13" height="14" rx="3" /><path d="m16 10 5-3v10l-5-3" /></>,
  talents: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18.5 14.5A6.5 6.5 0 0 1 21.5 20" /></>,
  clashes: <><path d="m13 2-9 12h7l-1 8 9-12h-7z" /></>,
  approvals: <><circle cx="8" cy="12" r="5" /><circle cx="16" cy="12" r="5" /></>,
  team: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>,
  comment: <><path d="M4 5h16v11H9l-5 4z" /></>,
  group: <><circle cx="12" cy="8" r="3" /><circle cx="5" cy="10" r="2.2" /><circle cx="19" cy="10" r="2.2" /><path d="M7 20a5 5 0 0 1 10 0M1.5 19a3.5 3.5 0 0 1 5-3M22.5 19a3.5 3.5 0 0 0-5-3" /></>,
  badge: <><path d="M12 2.5 14.5 4l3-.2.9 2.9 2.6 1.7-.9 2.9.9 2.9-2.6 1.7-.9 2.9-3-.2L12 21.5 9.5 20l-3 .2-.9-2.9L3 15.6l.9-2.9L3 9.8l2.6-1.7.9-2.9 3 .2z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  hidden: <><path d="m3 3 18 18" /><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.1 6.1C3.4 8 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.1-.9" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
}

export type AdminIconName = keyof typeof paths

export function AdminIcon({ name, size = 18 }: { name: AdminIconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...base}>
      {paths[name]}
    </svg>
  )
}
