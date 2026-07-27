import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';

function strictProductionSecretsPlugin(): Plugin {
  return {
    name: 'strict-production-secrets',
    configResolved(config) {
      if (config.command === 'build' && config.mode === 'production') {
        const env = loadEnv(config.mode, config.root, '');
        const hmac = env.VITE_HMAC_SECRET || process.env.VITE_HMAC_SECRET;
        const key = env.VITE_STORAGE_ENCRYPTION_KEY || process.env.VITE_STORAGE_ENCRYPTION_KEY;

        const isHmacInvalid = !hmac || hmac.trim() === '' || hmac === 'CHANGE_THIS_TO_A_RANDOM_64_CHAR_HEX_SECRET';
        const isKeyInvalid = !key || key.trim() === '' || key === 'AllegroDevEncryptionKeyFallback2026';

        if (isHmacInvalid || isKeyInvalid) {
          const errors: string[] = [];
          if (isHmacInvalid) errors.push('VITE_HMAC_SECRET is missing or set to placeholder string.');
          if (isKeyInvalid) errors.push('VITE_STORAGE_ENCRYPTION_KEY is missing or set to placeholder string.');

          console.error('\n❌ [SECURITY BUILD ERROR] Production build aborted due to missing/insecure secrets:');
          errors.forEach(e => console.error(`   - ${e}`));
          console.error('Please configure valid secrets in your environment / .env file before building for production.\n');

          throw new Error(`[SECURITY] Missing required production environment variables:\n${errors.join('\n')}`);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [strictProductionSecretsPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
