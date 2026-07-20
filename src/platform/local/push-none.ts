import type { PushProvider } from "@/platform/types";

/** No web-push (D-3 deferred). In-app Alerts panel is separate. */
export const nonePushProvider: PushProvider = {
  id: "push-none",
  mode: "none",
  isSupported() {
    return typeof Notification !== "undefined";
  },
  getPermission() {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  },
  async requestPermission() {
    if (typeof Notification === "undefined") return "unsupported";
    try {
      return await Notification.requestPermission();
    } catch {
      return "unsupported";
    }
  },
  async notify(title, body) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }
    try {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    } catch {
      /* ignore */
    }
  },
};
