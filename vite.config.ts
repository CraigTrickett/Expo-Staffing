import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

// Ensure Firebase configuration from firebase-applet-config.json is available
try {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseAppletConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!process.env.VITE_FIREBASE_API_KEY && firebaseAppletConfig.apiKey) {
      process.env.VITE_FIREBASE_API_KEY = firebaseAppletConfig.apiKey;
    }
    if (!process.env.VITE_FIREBASE_AUTH_DOMAIN && firebaseAppletConfig.authDomain) {
      process.env.VITE_FIREBASE_AUTH_DOMAIN = firebaseAppletConfig.authDomain;
    }
    if (!process.env.VITE_FIREBASE_PROJECT_ID && firebaseAppletConfig.projectId) {
      process.env.VITE_FIREBASE_PROJECT_ID = firebaseAppletConfig.projectId;
    }
    if (!process.env.VITE_FIREBASE_STORAGE_BUCKET && firebaseAppletConfig.storageBucket) {
      process.env.VITE_FIREBASE_STORAGE_BUCKET = firebaseAppletConfig.storageBucket;
    }
    if (!process.env.VITE_FIREBASE_MESSAGING_SENDER_ID && firebaseAppletConfig.messagingSenderId) {
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = firebaseAppletConfig.messagingSenderId;
    }
    if (!process.env.VITE_FIREBASE_APP_ID && firebaseAppletConfig.appId) {
      process.env.VITE_FIREBASE_APP_ID = firebaseAppletConfig.appId;
    }
  }
} catch {
  // Ignore errors reading fallback config
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
