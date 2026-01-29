// Demo login behavior:
// - sets dp-auth = true
// - sets role = Submitter
// - stores email into profile (nice for notifications targeting)
// - redirects to dashboard

const ROLE_STORAGE_KEY = "constellation:role:v1";
const USER_STORAGE_KEY = "constellation:user:v1";

function setAuth(isAuthed) {
  try {
    localStorage.setItem("dp-auth", isAuthed ? "true" : "false");
  } catch (_) {}
}

function setRole(role) {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  } catch (_) {}
}

function mergeEmailIntoProfile(email) {
  if (!email) return;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    const profile = raw ? JSON.parse(raw) : {};
    const next = { ...(profile || {}), email: String(email).trim() };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}
}

function showError(msg) {
  const el = document.getElementById("loginError");
  if (!el) return;
  el.textContent = msg || "";
  el.hidden = !msg;
}

function init() {
  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    showError("");

    const email = (emailEl?.value || "").trim();
    const pass = (passEl?.value || "").trim();

    if (!email || !email.includes("@")) {
      showError("Please enter a valid email address.");
      emailEl?.focus();
      return;
    }

    if (!pass) {
      showError("Please enter a password.");
      passEl?.focus();
      return;
    }

    // Demo: accept anything
    setAuth(true);
    setRole("Submitter");
    mergeEmailIntoProfile(email);

    window.location.href = "/src/pages/dashboard/index.html";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
