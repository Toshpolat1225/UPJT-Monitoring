import { ReactNode } from 'react'

type IconProps = { className?: string; size?: number }

const base = (size?: number) => ({
  width: size ?? 20,
  height: size ?? 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const IconDashboard = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
)
export const IconReferences = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
)
export const IconReports = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/></svg>
)
export const IconSettings = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
)
export const IconBuilding = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></svg>
)
export const IconLayers = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
)
export const IconFuel = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M3 22h12V4H3v18z"/><path d="M15 8h4l2 3v8a2 2 0 0 1-2 2h-4"/><path d="M7 8h4"/><path d="M7 12h4"/><path d="M7 16h4"/></svg>
)
export const IconTruck = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
)
export const IconCalendar = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
)
export const IconLimit = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
)
export const IconGrid = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
)
export const IconShield = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
)
export const IconUsers = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
)
export const IconPlus = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
)
export const IconEdit = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
)
export const IconTrash = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
)
export const IconSearch = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
)
export const IconClose = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
)
export const IconLogout = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
)
export const IconChevronDown = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><polyline points="6 9 12 15 18 9"/></svg>
)
export const IconChevronRight = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><polyline points="9 18 15 12 9 6"/></svg>
)
export const IconAlert = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
)
export const IconCheck = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><polyline points="20 6 9 17 4 12"/></svg>
)
export const IconMenu = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
)
export const IconSection = ({ className, size }: IconProps) => (
  <svg {...base(size)} className={className}><rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="15" width="18" height="6" rx="1"/></svg>
)
