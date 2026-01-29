// Settings page logic:
// - Demo access: Role + Auth toggle (with redirect)
// - Profile fields + avatar upload
//
// Depends on window.DatasetPortal helpers exposed by src/assets/js/includes.js

function getAuthFromLocalStorage() {
  try {
    const raw = (localStorage.getItem("dp-auth") ?? "false")
      .toString()
      .toLowerCase();
    return raw === "true" || raw === "1" || raw === "yes";
  } catch (_) {
    return false;
  }
}

function setAuthToLocalStorage(isAuthed) {
  try {
    localStorage.setItem("dp-auth", isAuthed ? "true" : "false");
    return true;
  } catch (e) {
    console.warn("Failed to set dp-auth:", e);
    return false;
  }
}

function showToast() {
  const toast = document.getElementById("saveToast");
  if (!toast) return;
  toast.hidden = false;
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    toast.hidden = true;
  }, 1200);
}

function safe(val) {
  return (val ?? "").toString();
}

function initDemoAccess() {
  const roleSelect = document.getElementById("roleSelect");
  const toggleAuthBtn = document.getElementById("toggleAuthBtn");
  const authStateLabel = document.getElementById("authStateLabel");

  // Role
  if (roleSelect && window.DatasetPortal?.getRole) {
    const currentRole = window.DatasetPortal.getRole();
    roleSelect.value = currentRole;

    roleSelect.addEventListener("change", () => {
      const nextRole = roleSelect.value;
      if (window.DatasetPortal?.setRole) {
        window.DatasetPortal.setRole(nextRole); // reloads inside includes.js helper
      } else {
        localStorage.setItem("constellation:role:v1", nextRole);
        window.location.reload();
      }
    });
  }

  // Auth label
  function renderAuthLabel() {
    const isAuthed = getAuthFromLocalStorage();
    if (authStateLabel)
      authStateLabel.textContent = isAuthed ? "Signed in" : "Signed out";
  }

  renderAuthLabel();

  // Auth toggle + redirect
  if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener("click", () => {
      const isAuthed = getAuthFromLocalStorage();
      const next = !isAuthed;

      setAuthToLocalStorage(next);

      // Redirect behavior:
      // - signing IN goes to dashboard
      // - signing OUT goes to homepage
      if (next) {
        window.location.href = "/src/pages/dashboard/index.html";
      } else {
        window.location.href = "/index.html";
      }
    });
  }
}

function initProfile() {
  const profile = window.DatasetPortal?.getUserProfile
    ? window.DatasetPortal.getUserProfile()
    : {};

  // Fill fields
  const map = {
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    email: profile.email,
    affiliation: profile.affiliation,
    orcid: profile.orcid,
  };

  Object.keys(map).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = safe(map[id]);
  });

  // Avatar preview
  const previewImg = document.getElementById("avatarPreviewImg");
  const previewInitials = document.getElementById("avatarPreviewInitials");

  function initialsFrom(p) {
    const a = safe(p.firstName).trim().slice(0, 1).toUpperCase();
    const b = safe(p.lastName).trim().slice(0, 1).toUpperCase();
    return a + b || "??";
  }

  function renderAvatar(p) {
    const has = !!safe(p.avatarDataUrl).trim();
    if (previewInitials) previewInitials.textContent = initialsFrom(p);

    if (previewImg) {
      if (has) {
        previewImg.src = p.avatarDataUrl;
        previewImg.alt =
          `${safe(p.firstName).trim()} ${safe(p.lastName).trim()}`.trim() ||
          "Avatar";
        previewImg.hidden = false;
        if (previewInitials) previewInitials.hidden = true;
      } else {
        previewImg.removeAttribute("src");
        previewImg.alt = "";
        previewImg.hidden = true;
        if (previewInitials) previewInitials.hidden = false;
      }
    }
  }

  renderAvatar(profile);

  // Avatar upload/remove
  const avatarFile = document.getElementById("avatarFile");
  const removeAvatar = document.getElementById("removeAvatar");
  const avatarError = document.getElementById("avatarError");

  function setAvatarError(msg) {
    if (!avatarError) return;
    avatarError.textContent = msg || "";
    avatarError.hidden = !msg;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  if (avatarFile) {
    avatarFile.addEventListener("change", async () => {
      setAvatarError("");
      const file = avatarFile.files && avatarFile.files[0];
      if (!file) return;

      const maxBytes = 2 * 1024 * 1024; // 2MB
      if (file.size > maxBytes) {
        setAvatarError("Please choose an image under 2MB.");
        avatarFile.value = "";
        return;
      }

      if (!file.type.startsWith("image/")) {
        setAvatarError("Please choose an image file.");
        avatarFile.value = "";
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        const nextProfile = { ...profile, avatarDataUrl: dataUrl };
        window.DatasetPortal?.saveUserProfile?.(nextProfile);
        Object.assign(profile, nextProfile);
        renderAvatar(profile);
      } catch (e) {
        setAvatarError(
          "Could not read that file. Please try a different image.",
        );
      } finally {
        avatarFile.value = "";
      }
    });
  }

  if (removeAvatar) {
    removeAvatar.addEventListener("click", () => {
      setAvatarError("");
      const nextProfile = { ...profile, avatarDataUrl: "" };
      window.DatasetPortal?.saveUserProfile?.(nextProfile);
      Object.assign(profile, nextProfile);
      renderAvatar(profile);
    });
  }

  // Save buttons
  const saveTop = document.getElementById("saveProfile");
  const saveBottom = document.getElementById("saveProfileBottom");

  function gatherProfileFromForm() {
    return {
      ...profile,
      firstName: safe(document.getElementById("firstName")?.value).trim(),
      middleName: safe(document.getElementById("middleName")?.value).trim(),
      lastName: safe(document.getElementById("lastName")?.value).trim(),
      email: safe(document.getElementById("email")?.value).trim(),
      affiliation: safe(document.getElementById("affiliation")?.value).trim(),
      orcid: safe(document.getElementById("orcid")?.value).trim(),
    };
  }

  function saveProfile() {
    const next = gatherProfileFromForm();
    window.DatasetPortal?.saveUserProfile?.(next);
    Object.assign(profile, next);
    renderAvatar(profile);
    showToast();
  }

  if (saveTop) saveTop.addEventListener("click", saveProfile);
  if (saveBottom) saveBottom.addEventListener("click", saveProfile);
}

function init() {
  initDemoAccess();
  initProfile();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
