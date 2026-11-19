/**
 * Safe, cross-platform haptic feedback helper using the Web Vibration API.
 * Provides subtle tactile feedback on supported mobile devices (Android, iOS PWA / WebKit).
 */

type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "selection";

export const triggerHaptic = (style: HapticStyle = "light"): void => {
  if (typeof window === "undefined" || !("navigator" in window)) return;

  try {
    if (typeof navigator.vibrate === "function") {
      switch (style) {
        case "selection":
        case "light":
          navigator.vibrate(8);
          break;
        case "medium":
          navigator.vibrate(18);
          break;
        case "heavy":
          navigator.vibrate(30);
          break;
        case "success":
          navigator.vibrate([10, 30, 15]);
          break;
        case "warning":
          navigator.vibrate([20, 40, 20]);
          break;
      }
    }
  } catch {
    // Gracefully ignore if browser policies restrict vibration
  }
};
