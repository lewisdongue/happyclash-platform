import type { ComponentType } from 'react'
import { AnimalsIcon, ClashIcon, HomeIcon, LifeIcon } from '@/components/icons/TabIcons'

export interface NavItem {
  to: string
  label: string
  Icon: ComponentType<{ size?: number; accent?: string }>
}

/** The four sections of the app, shared by the phone dock and the desktop top bar. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/clash', label: 'Clash', Icon: ClashIcon },
  { to: '/animals', label: 'Animals', Icon: AnimalsIcon },
  { to: '/life', label: 'Life', Icon: LifeIcon },
]

export const INACTIVE_ICON_ACCENT = '#9AA2C8'
