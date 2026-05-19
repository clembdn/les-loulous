// FinAuzi Auth Context — Firebase Authentication with UID authorization.
// Only the two hardcoded UIDs are allowed access.
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '../lib/firebase.js'
import { isAuthorizedUid } from '../config/people.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  const loginWithEmail = useCallback(async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const logout = useCallback(async () => {
    await signOut(auth)
  }, [])

  const resetPassword = useCallback(async (email) => {
    await sendPasswordResetEmail(auth, email)
  }, [])

  const value = useMemo(() => ({
    currentUser,
    isAuthenticated: !!currentUser,
    isAuthorized: currentUser ? isAuthorizedUid(currentUser.uid) : false,
    isLoading,
    loginWithEmail,
    logout,
    resetPassword,
  }), [currentUser, isLoading, loginWithEmail, logout, resetPassword])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
