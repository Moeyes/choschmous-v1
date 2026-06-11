import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login'],
      disallow: [
        '/dashboard',
        '/events',
        '/sports',
        '/organizations',
        '/users',
        '/cards',
        '/reports',
        '/participation',
        '/register',
        '/by-number',
        '/by-category',
        '/by-sport',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
