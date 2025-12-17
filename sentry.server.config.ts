// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring - sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable Sentry Logs
  _experiments: {
    enableLogs: true,
  },

  // Enable debug mode in development
  debug: process.env.NODE_ENV !== "production",

  // Environment tag
  environment: process.env.NODE_ENV,

  // Filter server errors
  beforeSend(event, hint) {
    const error = hint.originalException;
    
    // Don't send expected auth errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes("no_init_data") ||
        message.includes("expired") ||
        message.includes("hash_mismatch")
      ) {
        return null;
      }
    }
    
    return event;
  },
});

