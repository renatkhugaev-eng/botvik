// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable Sentry Logs
  _experiments: {
    enableLogs: true,
  },

  // Session Replay for debugging (only in production)
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Enable debug mode in development
  debug: process.env.NODE_ENV !== "production",

  // Environment tag
  environment: process.env.NODE_ENV,

  // Filter out non-critical errors
  beforeSend(event, hint) {
    const error = hint.originalException;
    
    // Ignore network errors (user offline, etc.)
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
      return null;
    }
    
    // Ignore ResizeObserver errors (browser quirk)
    if (error instanceof Error && error.message.includes("ResizeObserver")) {
      return null;
    }
    
    return event;
  },

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text for privacy
      maskAllText: false,
      // Block all media for performance
      blockAllMedia: true,
    }),
  ],
});

