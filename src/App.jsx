import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/platform/ProtectedRoute.jsx'
import Splash from '@/platform/Splash.jsx'
import LoginView from '@/platform/LoginView.jsx'
import DashboardView from '@/platform/DashboardView.jsx'
import ComingSoonView from '@/platform/ComingSoonView.jsx'

const FinauziApp = lazy(() => import('@/apps/finauzi/FinauziApp.jsx'))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardView />} />
        <Route
          path="/finauzi"
          element={
            <Suspense fallback={<Splash />}>
              <FinauziApp />
            </Suspense>
          }
        />
        <Route path="/courses" element={<ComingSoonView appId="courses" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
