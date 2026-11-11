
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nik Finance Tracker',
    short_name: 'Nik Finance',
    description: 'Premium Indigo-themed personal finance tracker.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    version: '2.0.1',
    orientation: 'portrait',
    background_color: '#0F1220',
    theme_color: '#5B5CE2',
    icons: [
      {
        src: '/icon.svg?v=2.0.1',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg?v=2.0.1',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg?v=2.0.1',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg?v=2.0.1',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
