import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 👈 把之前的 '/archive/' 改成下面的 '/'
  // 这样 Vercel 就能在根目录正确找到你的 CSS 和 JS 了
  base: '/', 
})
