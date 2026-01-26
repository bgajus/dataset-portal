// src/pages/settings/settings.js
// Profile settings (demo) — stores user info + avatar in localStorage
//
// Updated: avatar initials preview can use Drupal username when in API mode
// (without persisting anything to Drupal yet).

const $ = (id) => document.getElementById(id);

const els = {
  form: $("profileForm"),
  first: $("firstName"),
  middle: $("middleName"),
  last: $("lastName"),
  email: $("email"),
  affiliation: $("affiliation"),
  orcid: $("orcid"),

  avatarFile: $("avatarFile"),
  avatarPreviewImg: $("avatarPreviewImg"),
  avatarPreviewInitials: $("avatarPreviewInitials"),
  avatarError: $("avatarError"),
  removeAvatar: $("removeAvatar"),

  saveTop: $("saveProfile"),
  saveBottom: $("saveProfileBottom"),
  toast: $("saveToast"),
};

let sessionAvatarModel = null;

function getProfile() {
  return window.DatasetPortal?.getUserProfile?.() || {
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    affiliation: "",
    orcid: "",
    avatarDataUrl: "",
  };
}

function setToast(text) {
  if (!els.toast) return;
  els.toast.textContent = text;
  els.toast.hidden = false;
  window.clearTimeout(setToast._t);
  setToast._t = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 1500);
}

function initialsFromName(name) {
  const n = String(name || "").trim();
  if (!n) return "??";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0]?.toUpperCase() || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() || "" : "";
  return (a + b) || "??";
}

function initials(firstName, lastName) {
  const f = String(firstName || "").trim();
  const l = String(lastName || "").trim();
  return `${f ? f[0].toUpperCase() : ""}${l ? l[0].toUpperCase() : ""}` || "??";
}

function getPreviewInitials(profile) {
  const f = String(profile.firstName || "").trim();
  const l = String(profile.lastName || "").trim();

  // If user hasn't filled first/last yet, and we have a Drupal session user,
  // show initials from that username so it feels auth-aware.
  if (!f && !l && sessionAvatarModel?.isAuthed && sessionAvatarModel?.displayName) {
    return initialsFromName(sessionAvatarModel.displayName);
  }

  return initials(profile.firstName, profile.lastName);
}

function renderAvatarPreview(profile) {
  const hasAvatar = !!String(profile.avatarDataUrl || "").trim();

  if (els.avatarPreviewImg) {
    if (hasAvatar) {
      els.avatarPreviewImg.src = profile.avatarDataUrl;
      els.avatarPreviewImg.alt =
        `${String(profile.firstName || "").trim()} ${String(profile.lastName || "").trim()}`.trim() ||
        sessionAvatarModel?.displayName ||
        "User avatar";
      els.avatarPreviewImg.hidden = false;
    } else {
      els.avatarPreviewImg.removeAttribute("src");
      els.avatarPreviewImg.alt = "";
      els.avatarPreviewImg.hidden = true;
    }
  }

  if (els.avatarPreviewInitials) {
    els.avatarPreviewInitials.textContent = getPreviewInitials(profile);
    els.avatarPreviewInitials.hidden = hasAvatar;
  }
}

function fillForm(profile) {
  if (els.first) els.first.value = profile.firstName || "";
  if (els.middle) els.middle.value = profile.middleName || "";
  if (els.last) els.last.value = profile.lastName || "";
  if (els.email) els.email.value = profile.email || "";
  if (els.affiliation) els.affiliation.value = profile.affiliation || "";
  if (els.orcid) els.orcid.value = profile.orcid || "";

  renderAvatarPreview(profile);
}

function sanitizeOrcid(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const stripped = raw
    .replace(/^https?:\/\/(www\.)?orcid\.org\//i, "")
    .replace(/[^0-9X-]/gi, "")
    .slice(0, 19);

  return stripped;
}

function validateAvatarFile(file) {
  if (!file) return "";
  if (!file.type || !file.type.startsWith("image/")) return "Please choose an image file.";

  const maxBytes = 600 * 1024; // 600 KB
  if (file.size > maxBytes) return "That image is a bit large for this demo (max ~600KB).";

  return "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function handleAvatarUpload() {
  if (!els.avatarFile) return;
  const file = els.avatarFile.files?.[0];

  if (els.avatarError) {
    els.avatarError.hidden = true;
    els.avatarError.textContent = "";
  }

  const err = validateAvatarFile(file);
  if (err) {
    if (els.avatarError) {
      els.avatarError.hidden = false;
      els.avatarError.textContent = err;
    }
    els.avatarFile.value = "";
    return;
  }

  if (!file) return;

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const profile = getProfile();
    profile.avatarDataUrl = dataUrl;

    window.DatasetPortal?.saveUserProfile?.(profile);
    renderAvatarPreview(profile);
    setToast("Avatar updated");
  } catch (e) {
    if (els.avatarError) {
      els.avatarError.hidden = false;
      els.avatarError.textContent = "Could not read that file.";
    }
  } finally {
    els.avatarFile.value = "";
  }
}

function handleRemoveAvatar() {
  const profile = getProfile();
  profile.avatarDataUrl = "";
  window.DatasetPortal?.saveUserProfile?.(profile);
  renderAvatarPreview(profile);
  setToast("Avatar removed");
}

function saveProfile() {
  const profile = getProfile();

  profile.firstName = String(els.first?.value || "").trim();
  profile.middleName = String(els.middle?.value || "").trim();
  profile.lastName = String(els.last?.value || "").trim();
  profile.email = String(els.email?.value || "").trim();
  profile.affiliation = String(els.affiliation?.value || "").trim();
  profile.orcid = sanitizeOrcid(els.orcid?.value || "");

  const ok = window.DatasetPortal?.saveUserProfile?.(profile);
  if (ok) {
    if (els.orcid) els.orcid.value = profile.orcid;
    renderAvatarPreview(profile);
    setToast("Saved");
  } else {
    setToast("Could not save");
  }
}

function init() {
  const profile = getProfile();
  fillForm(profile);

  // If includes/session resolves later, update preview initials if needed
  window.addEventListener("dp:session-ready", (e) => {
    sessionAvatarModel = e?.detail?.avatarModel || null;
    renderAvatarPreview(getProfile());
  });

  els.avatarFile?.addEventListener("change", handleAvatarUpload);
  els.removeAvatar?.addEventListener("click", handleRemoveAvatar);

  els.saveTop?.addEventListener("click", saveProfile);
  els.saveBottom?.addEventListener("click", saveProfile);

  const onNameInput = () => {
    const p = getProfile();
    const firstName = String(els.first?.value || "").trim();
    const lastName = String(els.last?.value || "").trim();
    renderAvatarPreview({ ...p, firstName, lastName });
  };

  els.first?.addEventListener("input", onNameInput);
  els.last?.addEventListener("input", onNameInput);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
