import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/shared/context/AuthContext.jsx'
import App from './App.jsx'
// Fonts auto-hébergées (précachées par la PWA → dispo offline, pas d'aller-retour Google Fonts)
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
