import { useEffect } from 'react'

const BG_RGB = { dark: '11 14 19', light: '250 250 251' }

// Applique le thème (mode + accent) au document : data-theme/data-accent sur <html>,
// color-scheme et <meta theme-color>. La zone suivante écrase ces valeurs à son montage.
export function useAppTheme(theme = 'dark', accent = 'indigo') {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.accent = accent
    root.style.colorScheme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', `rgb(${BG_RGB[theme] || BG_RGB.dark})`)
  }, [theme, accent])
}
