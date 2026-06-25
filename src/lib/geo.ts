const VE_MIN_LAT = -1;
const VE_MAX_LAT = 14;
const VE_MIN_LNG = -74;
const VE_MAX_LNG = -59;

export function isValidCoords(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= VE_MIN_LAT &&
    lat <= VE_MAX_LAT &&
    lng >= VE_MIN_LNG &&
    lng <= VE_MAX_LNG
  );
}
