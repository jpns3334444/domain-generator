'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init('phc_PoVxjHWcERydfpkrhLiFcLvDfiXVYnMDw3WGNecmOqf', {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      session_recording: {
        recordCrossOriginIframes: true,
      },
    })

    // Link existing user ID to PostHog
    // User IDs are created by getUserId() in preferences.ts when users interact
    import('@/lib/preferences').then(({ getUserId }) => {
      const userId = getUserId()
      if (userId) {
        posthog.identify(userId)
      }
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
