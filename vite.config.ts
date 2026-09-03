import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/spelling-flashcard-game/',
  plugins: [react()],
})
