import { BarChart3, BookCopy, BookOpen, BookPlus, Building2, Database, DoorOpen, FileUp, HandCoins, History, LayoutDashboard, LibraryBig, Mail, PackageX, Receipt, ScrollText, ShoppingCart, ShieldCheck, Users, UserCog, UserRound, BookMarked, BookUp, Bell, ClipboardList, Contact, Landmark, Layers, type LucideIcon } from 'lucide-react'
import type { Role } from './types'

export interface NavItem { to: string; label: string; icon: LucideIcon; roles: Role[]; end?: boolean }
export interface NavGroup { heading: string; items: NavItem[] }
const ALL_STAFF: Role[] = ['Admin', 'Librarian', 'Student Assistant']
const DESK: Role[] = ALL_STAFF

export const staffNav: NavGroup[] = [
  { heading: 'Overview', items: [{ to: '/staff', label: 'Dashboard', icon: LayoutDashboard, roles: DESK, end: true }] },
  { heading: 'Catalog', items: [
    { to: '/staff/catalog', label: 'Books', icon: LibraryBig, roles: ALL_STAFF, end: true },
    { to: '/staff/catalog/add', label: 'Add Book', icon: BookPlus, roles: ALL_STAFF },
    { to: '/staff/catalog/entities/writers', label: 'Writers', icon: UserRound, roles: ALL_STAFF },
    { to: '/staff/catalog/entities/publishers', label: 'Publishers', icon: Building2, roles: ALL_STAFF },
    { to: '/staff/catalog/entities/corporates', label: 'Corporate Entities', icon: Landmark, roles: ALL_STAFF },
    { to: '/staff/catalog/entities/contributors', label: 'Individual Contributors', icon: Contact, roles: ALL_STAFF },
    { to: '/staff/catalog/entities/publications', label: 'Publications', icon: Layers, roles: ALL_STAFF },
    { to: '/staff/catalog/entities/corporate-contributors', label: 'Corporate Contributors', icon: BookCopy, roles: ALL_STAFF },
    { to: '/staff/import/books', label: 'Import Books', icon: FileUp, roles: ALL_STAFF },
  ] },
  { heading: 'Members', items: [
    { to: '/staff/members', label: 'Library Users', icon: Users, roles: DESK },
    { to: '/staff/admins', label: 'Admin Accounts', icon: UserCog, roles: ALL_STAFF },
    { to: '/staff/import/users', label: 'Import Users', icon: FileUp, roles: ALL_STAFF },
  ] },
  { heading: 'Circulation', items: [
    { to: '/staff/borrow', label: 'Walk-in Borrowing', icon: BookUp, roles: DESK },
    { to: '/staff/reservations', label: 'Reservation Queue', icon: ClipboardList, roles: DESK },
    { to: '/staff/issued', label: 'Issued Books', icon: BookOpen, roles: DESK },
    { to: '/staff/history', label: 'Borrowing History', icon: History, roles: DESK },
    { to: '/staff/fines', label: 'Fines Management', icon: HandCoins, roles: DESK },
    { to: '/staff/lost', label: 'Lost & Damaged', icon: PackageX, roles: DESK },
  ] },
  { heading: 'Operations', items: [
    { to: '/staff/reports', label: 'Reports', icon: BarChart3, roles: ALL_STAFF },
    { to: '/staff/visits', label: 'Entrance & Exit', icon: DoorOpen, roles: DESK },
    { to: '/staff/messages', label: 'Messages', icon: Mail, roles: DESK },
    { to: '/staff/notifications', label: 'Notifications', icon: Bell, roles: DESK },
    { to: '/staff/activity', label: 'Activity Log', icon: ScrollText, roles: ALL_STAFF },
    { to: '/staff/backups', label: 'Backup Manager', icon: Database, roles: ALL_STAFF },
    { to: '/staff/profile', label: 'My Profile', icon: ShieldCheck, roles: ALL_STAFF },
  ] },
]

export const memberNav: NavGroup[] = [
  { heading: 'Library', items: [
    { to: '/member', label: 'Dashboard', icon: LayoutDashboard, roles: ['Member'], end: true },
    { to: '/member/catalog', label: 'Search Catalog', icon: LibraryBig, roles: ['Member'] },
    { to: '/member/cart', label: 'My Cart', icon: ShoppingCart, roles: ['Member'] },
  ] },
  { heading: 'My Books', items: [
    { to: '/member/reserved', label: 'Reserved Books', icon: BookMarked, roles: ['Member'] },
    { to: '/member/reservations/history', label: 'Reservation History', icon: Receipt, roles: ['Member'] },
    { to: '/member/borrowed', label: 'Borrowed Books', icon: BookOpen, roles: ['Member'] },
    { to: '/member/borrowed/history', label: 'Borrowing History', icon: History, roles: ['Member'] },
  ] },
  { heading: 'Account', items: [
    { to: '/member/messages', label: 'Messages', icon: Mail, roles: ['Member'] },
    { to: '/member/notifications', label: 'Notifications', icon: Bell, roles: ['Member'] },
    { to: '/member/profile', label: 'My Profile', icon: UserRound, roles: ['Member'] },
  ] },
]
export const staffHome = (_r: Role) => '/staff'
