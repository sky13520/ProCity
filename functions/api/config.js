import { json } from "../_lib/http.js";

export function onRequestGet(context) {
  return json(
    { googleMapsApiKey: String(context.env.GOOGLE_MAPS_API_KEY || "") },
    200,
    { "cache-control": "no-store" }
  );
}
