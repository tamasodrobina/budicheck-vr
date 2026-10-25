// Lightweight, privacy-first analytics tracker for BudiCheck
// No cookies, GDPR-compliant, fire-and-forget

const VISITOR_ID_KEY = 'budicheck_vid';

export function getVisitorId() {
  try {
    let vid = localStorage.getItem(VISITOR_ID_KEY);
    if (!vid) {
      vid = 'vid_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      localStorage.setItem(VISITOR_ID_KEY, vid);
    }
    return vid;
  } catch (e) {
    return 'anonymous';
  }
}

let lastTrackedPath = null;
let lastTrackedTime = 0;

export function trackPageView(path = window.location.pathname) {
  const now = Date.now();
  // Debounce consecutive calls to the same path within 3 seconds
  if (lastTrackedPath === path && (now - lastTrackedTime) < 3000) {
    return;
  }
  lastTrackedPath = path;
  lastTrackedTime = now;

  trackEvent('pageview', null, path);
}

export function trackEvent(eventType, eventData = null, path = window.location.pathname) {
  try {
    const payload = {
      event_type: eventType,
      path: path || '/',
      referrer: document.referrer || '',
      visitor_id: getVisitorId(),
      event_data: eventData
    };

    const url = '/api/analytics/track';

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {
      // Silently ignore network or offline issues
    });
  } catch (e) {
    // Never disrupt the user interface for tracking errors
  }
}
