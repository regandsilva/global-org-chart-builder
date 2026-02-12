import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use '/' for dev so localhost:5173 works; use repo path for GitHub Pages production build
  base: command === 'serve' ? '/' : '/global-org-chart-builder/',
}))
