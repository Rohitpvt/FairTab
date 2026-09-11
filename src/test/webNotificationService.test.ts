import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  WebNotificationService,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "../infrastructure/notifications/webNotificationService";

describe("WebNotificationService Unit Tests", () => {
  let service: WebNotificationService;

  beforeEach(() => {
    service = new WebNotificationService();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("retrieves default preferences when none are stored", () => {
    const prefs = service.getPreferences();
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(prefs.enabled).toBe(true);
    expect(prefs.expenses).toBe(true);
    expect(prefs.budgets).toBe(true);
    expect(prefs.settlements).toBe(true);
  });

  it("saves and loads updated notification preferences", () => {
    const customPrefs = {
      enabled: false,
      expenses: false,
      budgets: true,
      settlements: false,
      reminders: true,
      recurring: false,
    };
    service.savePreferences(customPrefs);
    const loaded = service.getPreferences();
    expect(loaded).toEqual(customPrefs);
  });

  it("correctly tracks and marks notified event IDs to avoid duplicate alerts", () => {
    const eventId = "expense_12345";
    expect(service.hasBeenNotified(eventId)).toBe(false);

    service.markAsNotified(eventId);
    expect(service.hasBeenNotified(eventId)).toBe(true);

    // Another event is not marked
    expect(service.hasBeenNotified("expense_99999")).toBe(false);
  });

  it("bounds the deduplication cache size without memory leak", () => {
    for (let i = 0; i < 250; i++) {
      service.markAsNotified(`event_${i}`);
    }
    // Oldest items should have been shifted out
    expect(service.hasBeenNotified("event_0")).toBe(false);
    // Recent items remain cached
    expect(service.hasBeenNotified("event_249")).toBe(true);
  });

  it("returns false for sendNotification when notifications are disabled in preferences", async () => {
    service.savePreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      enabled: false,
    });

    const result = await service.sendNotification("Test Title", {
      body: "Test Body",
    });
    expect(result).toBe(false);
  });

  it("handles requestPermission gracefully when Notification API is mocked", async () => {
    vi.spyOn(service, "isSupported").mockReturnValue(true);
    const requestMock = vi.fn().mockResolvedValue("granted");
    (window as unknown as { Notification: { requestPermission: typeof requestMock } }).Notification = {
      requestPermission: requestMock,
    };

    const result = await service.requestPermission();
    expect(result).toBe("granted");
    expect(service.getPreferences().enabled).toBe(true);
  });
});
