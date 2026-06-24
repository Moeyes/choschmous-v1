import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// CHOS-303: Cloudflare reverse-proxy IPs that should be trusted for
// X-Forwarded-For header forwarding. These are the ranges Cloudflare uses
// to contact origins. Keep in sync with Cloudflare's published IP list.
// In production the ALB Security Group already restricts inbound to CF IPs,
// so this is a defense-in-depth trust declaration for Next.js logging/tracing.
const CLOUDFLARE_TRUSTED_PROXIES = [
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '108.162.192.0/18',
  '131.0.72.0/22',
  '141.101.64.0/18',
  '162.158.0.0/15',
  '172.64.0.0/13',
  '173.245.48.0/20',
  '188.114.96.0/20',
  '190.93.240.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const nextConfig: NextConfig = {
  output: 'standalone',

  // CHOS-303: Trust Cloudflare as a reverse proxy for correct IP attribution.
  // Without this, req.ip returns the Cloudflare edge IP, not the client IP.
  // The actual client IP is in the CF-Connecting-IP header, which Cloudflare
  // sets and which cannot be spoofed by clients (CF strips it from inbound requests).
  experimental: {
    // Next.js 15+: trust proxy declaration
    serverExternalPackages: [],
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_PROXY_TARGET || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },

  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    const scriptSrc = isDev ? "'self' 'unsafe-eval' 'unsafe-inline'" : "'self' 'unsafe-inline' 'strict-dynamic'";

    return [
      // ── Security headers for all routes ──────────────────────────────────
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; connect-src 'self' https://api.cloudinary.com; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'`,
          },
          {
            key: 'Strict-Transport-Security',
            // CHOS-303: Cloudflare also enforces HSTS via zone settings;
            // this header is for direct connections and browser HSTS preload.
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },

      // ── Next.js content-hashed static assets: immutable 1 year ──────────
      // Cloudflare Cache Rule also sets 1yr edge TTL; these headers instruct
      // both the CDN and the browser. Content hash in filename = safe forever.
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          // CHOS-303: CDN-Cache-Control lets Cloudflare cache independently
          // of the browser. Same value here — both may hold for 1 year.
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },

      // ── Static media (fonts, images) ─────────────────────────────────────
      {
        source: '/:all*(woff2|woff|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|avif|ico)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },

      // ── API proxy: NEVER cache ────────────────────────────────────────────
      // The Cloudflare Cache Rule also bypasses cache for /api/*; these headers
      // are the belt to that suspenders and ensure ALB/browser never caches PII.
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'no-store',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },

      // ── Public SSR pages (login, privacy, public event listings) ─────────
      // These are served to unauthenticated users and are safe to cache at edge.
      // 60s edge TTL with stale-while-revalidate so the origin isn't hammered.
      // CDN-Cache-Control controls the Cloudflare edge TTL independently;
      // Cache-Control controls the browser TTL (shorter, to ensure freshness).
      {
        source: '/privacy',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=60', // 5min browser
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=300', // 1hr edge
          },
        ],
      },
      {
        source: '/login',
        headers: [
          // Login page must NOT be cached (CSRF token in page, returnUrl varies)
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'no-store',
          },
        ],
      },

      // ── Authenticated portal routes: never cache ─────────────────────────
      // These routes require access_token cookie. Cloudflare Cache Rule already
      // bypasses cache when access_token cookie is present; these headers are
      // belt-and-suspenders for intermediate proxies.
      {
        source:
          '/(dashboard|events|sports|organizations|users|cards|reports|participation|register|by-number|by-category|by-sport|leader-registration|registrations|open-survey|category-submissions|sport-submissions|organizer-registration|organizer-roles)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
};

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default analyzer(withNextIntl(nextConfig));

// import type { NextConfig } from 'next';
// import createNextIntlPlugin from 'next-intl/plugin';
// import withBundleAnalyzer from '@next/bundle-analyzer';

// const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// const nextConfig: NextConfig = {
//   output: 'standalone',
//   async rewrites() {
//     return [
//       {
//         source: '/api/:path*',
//         destination: `${process.env.API_PROXY_TARGET || 'http://localhost:8000'}/api/:path*`,
//       },
//     ];
//   },
//   async headers() {
//     const isDev = process.env.NODE_ENV === 'development';
//     const scriptSrc = isDev
//       ? "'self' 'unsafe-eval' 'unsafe-inline'"
//       : "'self' 'unsafe-inline' 'strict-dynamic'";
//     return [
//       {
//         source: '/(.*)',
//         headers: [
//           {
//             key: 'Content-Security-Policy',
//             value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; connect-src 'self' https://api.cloudinary.com; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'`,
//           },
//           {
//             key: 'Strict-Transport-Security',
//             value: 'max-age=63072000; includeSubDomains; preload',
//           },
//           { key: 'X-Frame-Options', value: 'DENY' },
//           { key: 'X-Content-Type-Options', value: 'nosniff' },
//           { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
//           { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
//           { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
//           { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
//           { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
//         ],
//       },
//       // CHOS-303: cache headers. Content-hashed build assets are immutable, so
//       // the CDN (Cloudflare) + browser may hold them for a year — this is what
//       // offloads the origin. Cloudflare honours these on proxied responses.
//       {
//         source: '/_next/static/:path*',
//         headers: [
//           { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
//         ],
//       },
//       {
//         source:
//           '/:all*(woff2|woff|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|avif|ico)',
//         headers: [
//           { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
//         ],
//       },
//       // The API proxy carries authenticated / PII responses — it must NEVER be
//       // cached at the edge, in a shared cache, or in the browser (governance).
//       {
//         source: '/api/:path*',
//         headers: [
//           { key: 'Cache-Control', value: 'no-store, max-age=0' },
//         ],
//       },
//     ];
//   },
// };

// const analyzer = withBundleAnalyzer({
//   enabled: process.env.ANALYZE === 'true',
// });

// export default analyzer(withNextIntl(nextConfig));
