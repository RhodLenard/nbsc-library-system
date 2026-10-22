import { lazy, Suspense } from 'react'
import { createHashRouter, Navigate, RouterProvider } from 'react-router'
import { StoreProvider } from './lib/store'
import { FeedbackProvider } from './components/ui'
import Shell from './components/Shell'
const Login = lazy(() => import('./pages/Login'))
const StaffDashboard = lazy(() => import('./pages/staff/Dashboard'))
const Catalog = lazy(() => import('./pages/staff/Catalog'))
const BookDetail = lazy(() => import('./pages/staff/BookDetail'))
const BookForm = lazy(() => import('./pages/staff/BookForm'))
const Entities = lazy(() => import('./pages/staff/Entities'))
const Members = lazy(() => import('./pages/staff/Members'))
const MemberDetail = lazy(() => import('./pages/staff/MemberDetail'))
const Admins = lazy(() => import('./pages/staff/Admins'))
const Borrow = lazy(() => import('./pages/staff/Borrow'))
const Reservations = lazy(() => import('./pages/staff/Reservations'))
const Issued = lazy(() => import('./pages/staff/Issued'))
const History = lazy(() => import('./pages/staff/History'))
const Fines = lazy(() => import('./pages/staff/Fines'))
const Lost = lazy(() => import('./pages/staff/Lost'))
const Reports = lazy(() => import('./pages/staff/Reports'))
const Visits = lazy(() => import('./pages/staff/Visits'))
const Activity = lazy(() => import('./pages/staff/Activity'))
const Backups = lazy(() => import('./pages/staff/Backups'))
const ImportBooks = lazy(() => import('./pages/staff/ImportBooks'))
const ImportUsers = lazy(() => import('./pages/staff/ImportUsers'))
const Messages = lazy(() => import('./pages/shared/Messages'))
const Notifications = lazy(() => import('./pages/shared/Notifications'))
const Profile = lazy(() => import('./pages/shared/Profile'))
const MemberDashboard = lazy(() => import('./pages/member/Dashboard'))
const MemberCatalog = lazy(() => import('./pages/member/Catalog'))
const MemberBook = lazy(() => import('./pages/member/BookDetail'))
const Cart = lazy(() => import('./pages/member/Cart'))
const Reserved = lazy(() => import('./pages/member/Reserved'))
const ReservationHistory = lazy(() => import('./pages/member/ReservationHistory'))
const Borrowed = lazy(() => import('./pages/member/Borrowed'))
const BorrowHistory = lazy(() => import('./pages/member/BorrowHistory'))

const router = createHashRouter([
  { path: '/login', Component: Login },
  {
    path: '/staff', element: <Shell kind="staff" />,
    children: [
      { index: true, Component: StaffDashboard },
      { path: 'catalog', Component: Catalog },
      { path: 'catalog/add', element: <BookForm mode="add" /> },
      { path: 'catalog/entities/:kind', Component: Entities },
      { path: 'catalog/:id', Component: BookDetail },
      { path: 'catalog/:id/edit', element: <BookForm mode="edit" /> },
      { path: 'import/books', Component: ImportBooks },
      { path: 'import/users', Component: ImportUsers },
      { path: 'members', Component: Members },
      { path: 'members/:id', Component: MemberDetail },
      { path: 'admins', Component: Admins },
      { path: 'borrow', Component: Borrow },
      { path: 'reservations', Component: Reservations },
      { path: 'issued', Component: Issued },
      { path: 'history', Component: History },
      { path: 'fines', Component: Fines },
      { path: 'lost', Component: Lost },
      { path: 'reports', Component: Reports },
      { path: 'visits', Component: Visits },
      { path: 'messages', Component: Messages },
      { path: 'notifications', Component: Notifications },
      { path: 'activity', Component: Activity },
      { path: 'backups', Component: Backups },
      { path: 'profile', Component: Profile },
    ],
  },
  {
    path: '/member', element: <Shell kind="member" />,
    children: [
      { index: true, Component: MemberDashboard },
      { path: 'catalog', Component: MemberCatalog },
      { path: 'book/:id', Component: MemberBook },
      { path: 'cart', Component: Cart },
      { path: 'reserved', Component: Reserved },
      { path: 'reservations/history', Component: ReservationHistory },
      { path: 'borrowed', Component: Borrowed },
      { path: 'borrowed/history', Component: BorrowHistory },
      { path: 'messages', Component: Messages },
      { path: 'notifications', Component: Notifications },
      { path: 'profile', Component: Profile },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])

export default function App() {
  return (
    <StoreProvider>
      <FeedbackProvider>
        <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm font-semibold text-slate-600">Loading library…</div>}>
          <RouterProvider router={router} />
        </Suspense>
      </FeedbackProvider>
    </StoreProvider>
  )
}
