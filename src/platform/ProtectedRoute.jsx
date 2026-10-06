import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import Splash from './Splash.jsx'
import Forbidden from './Forbidden.jsx'

export default function ProtectedRoute() {
  const { isLoading, isAuthenticated, isAuthorized } = useAuth()
  const location = useLocation()
  if (isLoading) return <Splash />
  // La page demandée suit jusqu'à la connexion, qui y ramène ensuite : un
  // lieu partagé depuis Google Maps (/trip/partage?…) ne doit pas se perdre.
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (!isAuthorized) return <Forbidden />
  return <Outlet />
}
