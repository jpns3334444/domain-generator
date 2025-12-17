import posthog from 'posthog-js'

// Track custom events
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    posthog.capture(eventName, properties)
  }
}

// Event name constants for type safety
export const AnalyticsEvents = {
  // Generation events
  GENERATION_STARTED: 'generation_started',
  GENERATION_COMPLETED: 'generation_completed',
  SEARCH_PERFORMED: 'search_performed',
  LOAD_MORE_CLICKED: 'load_more_clicked',
  FEEDBACK_SUBMITTED: 'feedback_submitted',

  // Domain events
  DOMAIN_SAVED: 'domain_saved',
  AFFILIATE_CLICK: 'affiliate_click',

  // UI events
  INPUT_FOCUSED: 'input_focused',
  MODE_CHANGED: 'mode_changed',
  TOOLTIP_DISMISSED: 'tooltip_dismissed',
  TLD_TOGGLED: 'tld_toggled',
  TLD_PRESET_SELECTED: 'tld_preset_selected',
} as const
