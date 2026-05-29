import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import Splash from './Splash.jsx'
import Forbidden from './Forbidden.jsx'

export default function ProtectedRoute() {
  const { isLoading, isAuthenticated, isAuthorized } = useAuth()
  if (isLoading) return <Splash />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAuthorized) return <Forbidden />
  return <Outlet />
}
