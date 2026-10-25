// Lightweight, privacy-first analytics tracker for BudiCheck
// No cookies, GDPR-compliant, fire-and-forget, with full admin self-exclusion

const VISITOR_ID_KEY = 'budicheck_vid';
export const IGNORE_ANALYTICS_KEY = 'budicheck_ignore_analytics';

export function isTrackingIgnored() {
  try {
    // 1. Explicit admin ignore flag in localStorage
    if (localStorage.getItem(IGNORE_ANALYTICS_KEY) === 'true') {
      return true;
    }
    // 2. Active admin token in localStorage
    if (localStorage.getItem('budicheck_admin_token')) {
      return true;
    }
    // 3. Admin path
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/config/admin')) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

export function setTrackingIgnored(ignored) {
  try {
    if (ignored) {
      localStorage.setItem(IGNORE_ANALYTICS_KEY, 'true');
    } else {
      localStorage.removeItem(IGNORE_ANALYTICS_KEY);
    }
  } catch (e) {}
}

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
  // Never track admin visits or admin pages
  if (isTrackingIgnored()) {
    return;
  }
  if (path && path.startsWith('/config/admin')) {
    return;
  }

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
  // Never track if visitor is admin
  if (isTrackingIgnored()) {
    return;
  }
  if (path && path.startsWith('/config/admin')) {
    return;
  }

  try {
    const adminToken = localStorage.getItem('budicheck_admin_token');
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['x-admin-token'] = adminToken;
    }

    const payload = {
      event_type: eventType,
      path: path || '/',
      referrer: document.referrer || '',
      visitor_id: getVisitorId(),
      event_data: eventData
    };

    const url = '/api/analytics/track';

    if (typeof navigator !== 'undefined' && navigator.sendBeacon && !adminToken) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }

    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {
      // Silently ignore network or offline issues
    });
  } catch (e) {
    // Never disrupt the user interface for tracking errors
  }
}
