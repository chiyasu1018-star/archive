import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 如果你的 GitHub 地址是 https://用户名.github.io/archive/
  // 那么这里就填 '/archive/'
  base: '/archive/', 
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
