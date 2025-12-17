'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

// Initialize PostHog immediately on client side (outside component)
if (typeof window !== 'undefined') {
  posthog.init('phc_PoVxjHWcERydfpkrhLiFcLvDfiXVYnMDw3WGNecmOqf', {
    api_host: '/a',
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    session_recording: {
      recordCrossOriginIframes: true,
    },
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[PostHog] Initialized successfully')
      }
    },
  })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>
}
