// src/shared/data/authClient.js
//
// Minimal auth/session detection for Drupal JSON:API.
// Uses /dkan-api/jsonapi so it always goes through the known-working proxy.
// (Vite proxy works in `npm run dev`. In `npm run preview`, you must serve behind a proxy
// or use absolute DKAN URLs with CORS configured.)

function getBasicAuthHeader() {
  const user = (import.meta.env.VITE_DKAN_BASIC_AUTH_USER || "").trim();
  const pass = (import.meta.env.VITE_DKAN_BASIC_AUTH_PASS || "").trim();
  if (!user || !pass) return "";
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

const JSONAPI_ENTRYPOINT = "/dkan-api/jsonapi";

async function requestJson(url, options = {}) {
  const auth = getBasicAuthHeader();

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/vnd.api+json",
      ...(auth ? { Authorization: auth } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("json");

  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");
    const msg =
      typeof body === "string"
        ? body
        : body?.errors?.[0]?.detail || body?.message || `HTTP ${res.status}`;
    throw new Error(`AuthClient ${res.status}: ${msg}`);
  }

  return isJson ? res.json() : null;
}

function toProxyJsonapiPath(hrefOrPath) {
  // Input could be:
  // - absolute: http://dkan-local.ddev.site/jsonapi/user/user/<uuid>
  // - relative: /jsonapi/user/user/<uuid>
  // We always return a path prefixed with /dkan-api
  if (!hrefOrPath) return "";

  let path = hrefOrPath;

  try {
    const u = new URL(hrefOrPath);
    path = `${u.pathname}${u.search || ""}`;
  } catch {
    // already a path
  }

  if (path.startsWith("/dkan-api/jsonapi")) return path;

  if (path.startsWith("/jsonapi")) {
    return `/dkan-api${path}`;
  }

  // If we somehow get just "jsonapi/..." without leading slash:
  if (path.startsWith("jsonapi")) {
    return `/dkan-api/${path}`;
  }

  return path;
}

export async function getSession() {
  const index = await requestJson(JSONAPI_ENTRYPOINT);

  // Authenticated responses include meta.links.me.href
  const meHref = index?.meta?.links?.me?.href || "";
  const mePath = toProxyJsonapiPath(meHref);

  if (!mePath) {
    return { isAuthenticated: false, user: null };
  }

  const me = await requestJson(mePath);
  const u = me?.data;

  return {
    isAuthenticated: true,
    user: {
      id: u?.id || "",
      uid: u?.attributes?.drupal_internal__uid ?? null,
      name: u?.attributes?.name || u?.attributes?.display_name || "",
      mail: u?.attributes?.mail || "",
      roles:
        (me?.included || [])
          .filter((x) => x?.type === "user_role--user_role")
          .map((x) => x?.attributes?.label || x?.attributes?.id || x?.id)
          .filter(Boolean) || [],
      _raw: me,
    },
  };
}
