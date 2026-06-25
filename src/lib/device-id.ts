// Anonymous device fingerprint stored in localStorage.
// Used to enforce "1 vote per device" without requiring login.
const KEY = "vsl-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
