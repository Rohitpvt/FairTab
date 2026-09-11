/**
 * Web & Device Notification Service
 * Manages notification permissions, dispatching rich system notifications via Service Worker,
 * vibration feedback, and deep linking actions for mobile browsers and PWAs.
 */

export interface NotificationPreferences {
  enabled: boolean;
  expenses: boolean;
  budgets: boolean;
  settlements: boolean;
  reminders: boolean;
  recurring: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  expenses: true,
  budgets: true,
  settlements: true,
  reminders: true,
  recurring: true,
};

const PREFS_STORAGE_KEY = "fairtab:notification_preferences";
const NOTIFIED_CACHE_KEY = "fairtab:notified_event_ids";

export class WebNotificationService {
  /**
   * Check if the browser supports notifications and service workers
   */
  public isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator
    );
  }

  /**
   * Get current browser notification permission
   */
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  }

  /**
   * Request notification permission from the user
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return "denied";
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        this.savePreferences({ ...this.getPreferences(), enabled: true });
      }
      return permission;
    } catch (err) {
      console.error("Error requesting notification permission:", err);
      return "denied";
    }
  }

  /**
   * Get user preferences from localStorage
   */
  public getPreferences(): NotificationPreferences {
    if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES;
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  }

  /**
   * Save user preferences to localStorage
   */
  public savePreferences(prefs: NotificationPreferences): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch (err) {
      console.error("Failed to save notification preferences:", err);
    }
  }

  /**
   * Check if a specific event ID has already been notified
   */
  public hasBeenNotified(eventId: string): boolean {
    if (typeof window === "undefined") return false;
    try {
      const raw = sessionStorage.getItem(NOTIFIED_CACHE_KEY) || "[]";
      const list: string[] = JSON.parse(raw);
      return list.includes(eventId);
    } catch {
      return false;
    }
  }

  /**
   * Mark an event ID as notified to avoid duplicate alerts
   */
  public markAsNotified(eventId: string): void {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(NOTIFIED_CACHE_KEY) || "[]";
      const list: string[] = JSON.parse(raw);
      if (!list.includes(eventId)) {
        list.push(eventId);
        // Keep cache bounded to last 200 events
        if (list.length > 200) list.shift();
        sessionStorage.setItem(NOTIFIED_CACHE_KEY, JSON.stringify(list));
      }
    } catch (err) {
      console.error("Failed to mark event as notified:", err);
    }
  }

  /**
   * Send a rich system notification to the device screen
   */
  public async sendNotification(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      badge?: string;
      tag?: string;
      data?: { url?: string; [key: string]: unknown };
      vibrate?: number[];
      requireInteraction?: boolean;
    }
  ): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (Notification.permission !== "granted") return false;

    const prefs = this.getPreferences();
    if (!prefs.enabled) return false;

    const defaultIcon = "/icons/icon-192.png";
    const defaultBadge = "/icons/icon-192.png";
    const defaultVibrate = [200, 100, 200, 100, 200];

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && "showNotification" in registration) {
        await registration.showNotification(title, {
          body: options?.body,
          icon: options?.icon || defaultIcon,
          badge: options?.badge || defaultBadge,
          tag: options?.tag,
          data: options?.data || { url: window.location.origin },
          vibrate: options?.vibrate || defaultVibrate,
          requireInteraction: options?.requireInteraction ?? false,
        } as NotificationOptions);
        return true;
      }
    } catch (swErr) {
      console.warn("ServiceWorker showNotification failed, attempting fallback:", swErr);
    }

    // Fallback to standard window Notification constructor if SW isn't ready
    try {
      const notif = new Notification(title, {
        body: options?.body,
        icon: options?.icon || defaultIcon,
        badge: options?.badge || defaultBadge,
        tag: options?.tag,
        data: options?.data,
      });

      if (options?.data?.url) {
        notif.onclick = () => {
          window.focus();
          if (options.data?.url) {
            window.location.href = options.data.url as string;
          }
        };
      }
      return true;
    } catch (err) {
      console.error("Failed to construct fallback notification:", err);
      return false;
    }
  }

  /**
   * Trigger an instant test notification
   */
  public async sendTestNotification(): Promise<boolean> {
    return this.sendNotification("🔔 FairTab Notifications Active", {
      body: "Instant lock screen & browser alerts are enabled for your account! You'll be alerted on new expenses, budget warnings & payments.",
      tag: "fairtab-test-notification",
      data: { url: window.location.origin + "#/overview" },
      vibrate: [150, 80, 150],
    });
  }
}

export const webNotificationService = new WebNotificationService();
