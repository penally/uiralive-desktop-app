import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL
  const useWasmLease = !!(env.VITE_WASM_LEASE === 'true' || env.VITE_X15)
  const isProd = mode === 'production'
  const isElectron = mode === 'electron' || !!(env.VITE_ELECTRON === 'true')
  return {
    base: isElectron ? './' : '/',
    plugins: [
      react(),
      isProd && viteCompression({ algorithm: 'gzip', ext: '.gz' }),
      isProd && viteCompression({ algorithm: 'brotliCompress', ext: '.br' }),
      viteStaticCopy({
        targets: [
          ...(!useWasmLease ? [{ src: 'servers-wasm/build/release.wasm', dest: 'assets' }] : []),
          ...(useWasmLease ? [{ src: 'servers-wasm/release-leased.js', dest: 'servers-wasm/build' }] : []),
        ],
      }),
      isProd && obfuscatorPlugin({
        apply: 'build',
        include: [/src\/components\/player\/servers\//],
        exclude: [/node_modules/, /wasmLoader\.ts$/],
        options: {
          compact: true,
          controlFlowFlattening: true,
          deadCodeInjection: true,
          debugProtection: false,
          disableConsoleOutput: false,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          selfDefending: false,
          simplify: true,
          splitStrings: true,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayEncoding: ['base64'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 2,
          stringArrayWrappersType: 'function',
          transformObjectKeys: true,
          unicodeEscapeSequence: false,
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        'servers-wasm': path.resolve(__dirname, 'servers-wasm/build/release.js'),
      },
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: ['beta.uira.live', 'm44g4o4gkkoggo408gws4sok.57.129.123.29.sslip.io'],
      proxy: {
        '/api': {
          target: apiTarget || 'http://localhost:3001',
          changeOrigin: true,
          ws: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }) => {
              const proof = req.headers['x-lease-proof'] ?? req.headers['X-Lease-Proof'];
              const val = Array.isArray(proof) ? proof[0] : proof;
              if (val) proxyReq.setHeader('X-Lease-Proof', val);
              const turnstile = req.headers['x-turnstile-token'] ?? req.headers['X-Turnstile-Token'];
              const turnstileVal = Array.isArray(turnstile) ? turnstile[0] : turnstile;
              if (turnstileVal) proxyReq.setHeader('X-Turnstile-Token', turnstileVal);
              const fwd = req.headers['x-forwarded-for'];
              const clientIp = req.socket?.remoteAddress ?? (Array.isArray(fwd) ? fwd[0] : fwd);
              if (clientIp) proxyReq.setHeader('X-Forwarded-For', clientIp);
              const origin = req.headers['origin'];
              const originVal = Array.isArray(origin) ? origin[0] : origin;
              if (!originVal || originVal === 'null') {
                const host = req.headers['host'];
                const hostVal = Array.isArray(host) ? host[0] : host;
                if (hostVal) proxyReq.setHeader('Origin', hostVal.startsWith('http') ? hostVal : `https://${hostVal}`);
              }
            });
          },
        },
      },
    },
    preview: {
      allowedHosts: ['beta.uira.live', 'ew8o4gccggokgowwsgwk40ck.57.129.123.29.sslip.io'],
      proxy: {
        '/api': {
          target: apiTarget || 'http://localhost:3001',
          changeOrigin: true,
          ws: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req: { headers: Record<string, string | string[] | undefined> }) => {
              const proof = req.headers['x-lease-proof'] ?? req.headers['X-Lease-Proof'];
              const val = Array.isArray(proof) ? proof[0] : proof;
              if (val) proxyReq.setHeader('X-Lease-Proof', val);
              const turnstile = req.headers['x-turnstile-token'] ?? req.headers['X-Turnstile-Token'];
              const turnstileVal = Array.isArray(turnstile) ? turnstile[0] : turnstile;
              if (turnstileVal) proxyReq.setHeader('X-Turnstile-Token', turnstileVal);
              const origin = req.headers['origin'];
              const originVal = Array.isArray(origin) ? origin[0] : origin;
              if (!originVal || originVal === 'null') {
                const host = req.headers['host'];
                const hostVal = Array.isArray(host) ? host[0] : host;
                if (hostVal) proxyReq.setHeader('Origin', hostVal.startsWith('http') ? hostVal : `https://${hostVal}`);
              }
            });
          },
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || (id.includes('react/') && !id.includes('react-router'))) return 'vendor-react';
              if (id.includes('react-router')) return 'vendor-router';
              if (id.includes('lucide-react')) return 'vendor-lucide';
              if (id.includes('hls.js')) return 'vendor-hls';
              if (id.includes('@iconify')) return 'vendor-iconify';
              if (id.includes('embla-carousel')) return 'vendor-embla';
              if (id.includes('crypto-js')) return 'vendor-crypto';
              if (id.includes('@marsidev')) return 'vendor-turnstile';
              return 'vendor-misc';
            }
            if (id.includes('player/servers/')) {
              if (id.includes('lease/proofSecret')) return 'l3';
              if (id.includes('lease/proofHeader')) return 'l4';
              if (id.includes('lease/decryptResponse')) return 'l5';
              return 'player-servers';
            }
            return null;
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
      chunkSizeWarningLimit: 550,
      cssMinify: true,
    },
  }
})
