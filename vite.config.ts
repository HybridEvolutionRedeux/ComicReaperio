import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 1. This looks for 'project.env' in your frontend folder
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './', // CRITICAL for PySide6 local loading
    plugins: [react()],
    define: {
      // 2. This does a "find and replace" for the key throughout your code
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        // 3. This matches your 'flat' folder structure
        '@': path.resolve(__dirname, './'),
      }
    }
  };
});