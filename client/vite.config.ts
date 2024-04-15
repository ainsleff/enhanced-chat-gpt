import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path, { resolve } from 'path';
import type { Plugin } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    fs: {
      cachedChecks: false,
    },
    host: 'localhost',
    port: 3090,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3080',
        changeOrigin: true,
      },
      '/oauth': {
        target: 'http://localhost:3080',
        changeOrigin: true,
      },
    },
  },
  define: {
    'import.meta.env.VITE_APP_TITLE': JSON.stringify(process.env.VITE_APP_TITLE),
    'import.meta.env.VITE_APP_DESCRIPTION': JSON.stringify(process.env.VITE_APP_DESCRIPTION),
    'import.meta.env.VITE_APP_KEYWORDS': JSON.stringify(process.env.VITE_APP_KEYWORDS),
    'import.meta.env.VITE_APP_AUTHOR': JSON.stringify(process.env.VITE_APP_AUTHOR),
    'import.meta.env.VITE_APP_URL': JSON.stringify(process.env.VITE_APP_URL),
    'import.meta.env.VITE_APP_OG_IMAGE': JSON.stringify(process.env.VITE_APP_OG_IMAGE),
    'import.meta.env.VITE_APP_TWITTER_IMAGE': JSON.stringify(process.env.VITE_APP_TWITTER_IMAGE),
    'import.meta.env.VITE_APP_FAVICON_32': JSON.stringify(process.env.VITE_APP_FAVICON_32),
    'import.meta.env.VITE_APP_FAVICON_16': JSON.stringify(process.env.VITE_APP_FAVICON_16),
    'import.meta.env.VITE_GOOGLE_ANALYTICS_ID': JSON.stringify(
      process.env.VITE_GOOGLE_ANALYTICS_ID,
    ),
    'import.meta.env.VITE_GOOGLE_ADS_ID': JSON.stringify(process.env.VITE_GOOGLE_ADS_ID),
  },
  // All other env variables are filtered out
  envDir: '../',
  envPrefix: ['VITE_', 'SCRIPT_', 'DOMAIN_', 'ALLOW_'],
  plugins: [react(), nodePolyfills(), sourcemapExclude({ excludeNodeModules: true })],
  publicDir: './public',
  build: {
    sourcemap: process.env.NODE_ENV === 'development',
    outDir: './dist',
    rollupOptions: {
      // external: ['uuid'],
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
      /**
       * Ignore "use client" waning since we are not using SSR
       * @see {@link https://github.com/TanStack/query/pull/5161#issuecomment-1477389761 Preserve 'use client' directives TanStack/query#5161}
       */
      onwarn(warning, warn) {
        if (
          // warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          warning.message.includes('Error when using sourcemap')
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
  resolve: {
    alias: {
      '~': path.join(__dirname, 'src/'),
      $fonts: resolve('public/fonts'),
    },
  },
});

interface SourcemapExclude {
  excludeNodeModules?: boolean;
}
export function sourcemapExclude(opts?: SourcemapExclude): Plugin {
  return {
    name: 'sourcemap-exclude',
    transform(code: string, id: string) {
      if (opts?.excludeNodeModules && id.includes('node_modules')) {
        return {
          code,
          // https://github.com/rollup/rollup/blob/master/docs/plugin-development/index.md#source-code-transformations
          map: { mappings: '' },
        };
      }
    },
  };
}

function htmlPlugin(env: ReturnType<typeof loadEnv>) {
  return {
    name: 'html-transform',
    transformIndexHtml: {
      enforce: 'pre' as const,
      transform: (html: string): string =>
        html.replace(/%(.*?)%/g, (match, p1) => env[p1] ?? match),
    },
  };
}
