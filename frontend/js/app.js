/* MonoLit — frontend logic */
(() => {
  "use strict";

  // If we landed via a URL with embedded HTTP basic-auth credentials
  // (e.g. https://user:pass@host/), strip them so fetch() doesn't reject
  // requests with "URL that includes credentials". The browser keeps the
  // auth cached for the origin once it's been sent successfully.
  try {
    if (window.location.href.includes("@") && window.history.replaceState) {
      const u = new URL(window.location.href);
      if (u.username || u.password) {
        u.username = "";
        u.password = "";
        window.history.replaceState({}, document.title, u.pathname + u.search + u.hash);
      }
    }
  } catch (_) { /* */ }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- Toasts ----------
  const toastWrap = $("#toast-wrap");
  function toast(msg, kind = "info", ttl = 3500) {
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = msg;
    toastWrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.4s, transform 0.4s";
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      setTimeout(() => el.remove(), 450);
    }, ttl);
  }

  // ---------- Boot loader (fake long load) ----------
  const bootSteps = [
    "Mounting world…",
    "Loading block registry…",
    "Compiling chunk geometry…",
    "Generating biome palette…",
    "Linking schematic library…",
    "Calibrating Bedrock placement…",
    "Negotiating with Fabric API…",
    "Polishing diamonds…",
    "Almost there…",
  ];
  function runBootLoader() {
    return new Promise((resolve) => {
      const fill = $("#boot-fill");
      const pct  = $("#boot-pct");
      const step = $("#boot-step");
      let p = 0, idx = 0;
      const tick = () => {
        const inc = 4 + Math.random() * 9;
        p = Math.min(100, p + inc);
        fill.style.width = p + "%";
        pct.textContent  = Math.floor(p) + "%";
        if (Math.random() < 0.55) {
          idx = (idx + 1) % bootSteps.length;
          step.textContent = bootSteps[idx];
        }
        if (p < 100) {
          setTimeout(tick, 120 + Math.random() * 240);
        } else {
          step.textContent = "Ready.";
          setTimeout(() => {
            $("#boot-loader").classList.add("hide");
            setTimeout(() => $("#boot-loader").remove(), 600);
            resolve();
          }, 280);
        }
      };
      tick();
    });
  }

  // ---------- Falling blueprint particles ----------
  function spawnParticles() {
    const wrap = $("#float-particles");
    const palette = ["#7fb3ff", "#5cd6c8", "#5fc63a", "#f5b942"];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement("div");
      p.className = "p";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = palette[i % palette.length];
      p.style.opacity = (0.08 + Math.random() * 0.18).toFixed(2);
      p.style.animationDuration = (10 + Math.random() * 18) + "s";
      p.style.animationDelay = (-Math.random() * 18) + "s";
      const size = 4 + Math.floor(Math.random() * 10);
      p.style.width = p.style.height = size + "px";
      wrap.appendChild(p);
    }
  }

  // ---------- Steve's farm build animation ----------
  function buildFarm() {
    const farm = $("#farm");
    if (!farm) return;
    // 7 cols x 3 rows = 21 cells. Pattern: top row glow, mid row wheat, bottom row dirt, with water column
    const cols = 7, rows = 3;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        cell.className = "blk";
        if (r === 0 && (c === 0 || c === cols - 1)) cell.classList.add("oak");
        else if (r === 0 && c === 3) cell.classList.add("glow");
        else if (r === 0) cell.classList.add("oak");
        else if (r === 1 && c === 3) cell.classList.add("water");
        else if (r === 1) cell.classList.add("wheat");
        else cell.classList.add("dirt");
        cell.style.gridColumnStart = c + 1;
        cell.style.gridRowStart    = r + 1;
        cells.push(cell);
        farm.appendChild(cell);
      }
    }
    const order = [...cells].sort((a, b) => {
      // build bottom row first, left-to-right, then up
      const ar = parseInt(a.style.gridRowStart), ac = parseInt(a.style.gridColumnStart);
      const br = parseInt(b.style.gridRowStart), bc = parseInt(b.style.gridColumnStart);
      if (ar !== br) return br - ar;
      return ac - bc;
    });
    order.forEach((c, i) => {
      c.style.animationDelay = (i * 0.18) + "s";
    });
    const totalDelay = order.length * 0.18;
    setTimeout(() => buildFarmReplay(cells), (totalDelay + 1.2) * 1000);
  }
  function buildFarmReplay(cells) {
    cells.forEach((c) => {
      c.style.opacity = "0";
      c.style.animation = "none";
      void c.offsetWidth;
      c.style.animation = "";
    });
    const order = [...cells].sort((a, b) => {
      const ar = parseInt(a.style.gridRowStart), ac = parseInt(a.style.gridColumnStart);
      const br = parseInt(b.style.gridRowStart), bc = parseInt(b.style.gridColumnStart);
      if (ar !== br) return br - ar;
      return ac - bc;
    });
    order.forEach((c, i) => { c.style.animationDelay = (i * 0.18) + "s"; });
    const totalDelay = order.length * 0.18;
    setTimeout(() => buildFarmReplay(cells), (totalDelay + 1.6) * 1000);
  }

  // ---------- Counter animation ----------
  function animateCounters() {
    $$("[data-counter]").forEach((el) => {
      const target = parseInt(el.dataset.counter, 10);
      const dur = 1400;
      const start = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.floor(target * eased).toLocaleString();
        if (k < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString() + (el.dataset.counter === "99" ? "%" : "");
      };
      requestAnimationFrame(tick);
    });
  }

  // ---------- Reveal-on-scroll ----------
  function setupReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    $$(".reveal").forEach((el) => io.observe(el));
  }

  // ---------- Active section nav ----------
  function setupNav() {
    const links = $$(".nav a");
    const sections = links
      .map((a) => $(a.getAttribute("href")))
      .filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const id = "#" + e.target.id;
          links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === id));
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach((s) => io.observe(s));

    $("#menu-toggle")?.addEventListener("click", () => {
      $("#primary-nav").classList.toggle("open");
    });
  }

  // ---------- API helpers ----------
  // Build absolute URL from path using origin only (no embedded user/pass).
  // Some browsers reject fetch() of relative URLs if the document URL was
  // ever loaded with HTTP basic-auth credentials embedded.
  function apiUrl(path) {
    if (/^https?:/i.test(path)) return path;
    return window.location.origin + (path.startsWith("/") ? path : "/" + path);
  }
  async function api(path, opts = {}) {
    const res = await fetch(apiUrl(path), {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch (_) { /* */ }
    if (!res.ok) {
      const detail = data && (data.detail || data.message);
      const err = new Error(typeof detail === "string" ? detail : `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- Auth state ----------
  const state = {
    me: null,
    launcher: { online: true, downloads_enabled: true, status_message: "" },
  };

  function renderAuth() {
    const me = state.me;
    if (me) {
      $("#auth-buttons").hidden = true;
      $("#user-area").hidden = false;
      $("#me-name").textContent = me.username;
      const roleEl = $("#me-role");
      roleEl.textContent = me.role;
      roleEl.className = "role " + me.role;
      $("#btn-admin").hidden = !(me.role === "Dev" || me.role === "Owner");
    } else {
      $("#auth-buttons").hidden = false;
      $("#user-area").hidden = true;
      $("#btn-admin").hidden = true;
    }
  }

  function renderLauncher() {
    const dot = $("#status-dot"), txt = $("#status-text");
    if (state.launcher.online) {
      dot.classList.remove("off");
      txt.textContent = "Online";
    } else {
      dot.classList.add("off");
      txt.textContent = "Offline";
    }
    $("#status-pill").title = state.launcher.status_message || "";
  }

  async function refreshMe() {
    try { state.me = await api("/api/auth/me"); } catch (_) { state.me = null; }
    renderAuth();
  }
  async function refreshLauncher() {
    try { state.launcher = await api("/api/launcher/state"); }
    catch (_) { /* */ }
    renderLauncher();
  }
  async function refreshAnnouncements() {
    try {
      const list = await api("/api/announcements");
      const bar = $("#announce-bar");
      const scroll = $("#announce-scroll");
      if (list && list.length) {
        const a = list[0];
        const when = new Date(a.created_at).toLocaleString();
        scroll.textContent = `[${a.author_role.toUpperCase()} ${a.author_username} · ${when}] ${a.body}    ★    `.repeat(3);
        bar.hidden = false;
      } else {
        bar.hidden = true;
      }
    } catch (_) { /* */ }
  }

  // ---------- Modals ----------
  function openModal(id) {
    const m = $(id);
    m.classList.add("show");
    m.setAttribute("aria-hidden", "false");
  }
  function closeModal(id) {
    const m = $(id);
    m.classList.remove("show");
    m.setAttribute("aria-hidden", "true");
  }
  $$(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.remove("show");
    });
    $$("[data-close]", m).forEach((b) =>
      b.addEventListener("click", () => m.classList.remove("show"))
    );
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $$(".modal.show").forEach((m) => m.classList.remove("show"));
  });

  // ---------- Tabs (auth + admin) ----------
  function bindTabs(tabsRoot, panesRoot) {
    const tabs = $$("button[data-tab]", tabsRoot);
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        const id = tab.dataset.tab;
        $$(".tab-pane", panesRoot).forEach((p) => p.classList.toggle("active", p.id === id));
        if (id === "adm-users") loadUsers();
        if (id === "adm-tickets") loadTickets();
        if (id === "adm-broadcast") loadBroadcasts();
        if (id === "adm-launcher") loadLauncherState();
      });
    });
  }
  // auth tabs operate inside the modal; we treat the form ids as panes
  function bindAuthTabs() {
    const tabs = $$("#auth-tabs button");
    const map = { register: "#form-register", login: "#form-login" };
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        Object.entries(map).forEach(([k, sel]) =>
          $(sel).classList.toggle("active", k === tab.dataset.tab)
        );
      });
    });
  }
  bindAuthTabs();

  // ---------- Auth flows ----------
  $("#btn-login")?.addEventListener("click", () => {
    $$("#auth-tabs button").forEach((t) => t.classList.toggle("active", t.dataset.tab === "login"));
    $("#form-register").classList.remove("active");
    $("#form-login").classList.add("active");
    openModal("#auth-modal");
  });
  $("#btn-register")?.addEventListener("click", () => {
    $$("#auth-tabs button").forEach((t) => t.classList.toggle("active", t.dataset.tab === "register"));
    $("#form-register").classList.add("active");
    $("#form-login").classList.remove("active");
    openModal("#auth-modal");
  });
  $("#btn-logout")?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    state.me = null;
    renderAuth();
    toast("Logged out.", "info");
  });

  // ---------- Hash copy buttons ----------
  $$(".hash-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const target = document.getElementById(btn.dataset.copy);
      if (!target) return;
      const text = target.textContent.trim();
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        const orig = btn.textContent;
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove("copied");
        }, 1400);
      } catch (_) {
        toast("Could not copy. Select and copy manually.", "warn");
      }
    });
  });

  // ---------- Profile ----------
  const profileBtn = $("#btn-profile");
  if (profileBtn) {
    profileBtn.addEventListener("click", () => {
      if (!state.me) return;
      openProfile();
    });
  }
  function openProfile() {
    const me = state.me;
    if (!me) return;
    $("#profile-name").textContent = me.username;
    $("#profile-avatar").textContent = me.username.charAt(0).toUpperCase();
    const roleEl = $("#profile-role");
    roleEl.textContent = me.role;
    roleEl.className = "role " + me.role;
    const created = me.created_at ? new Date(me.created_at).toLocaleDateString() : "—";
    const lastSeen = me.last_seen_at ? new Date(me.last_seen_at).toLocaleString() : "—";
    $("#profile-meta").innerHTML = `Joined: <strong>${escapeHtml(created)}</strong> · Last seen: <strong>${escapeHtml(lastSeen)}</strong>`;
    $("#profile-alert").textContent = "";
    $("#form-change-password").reset();
    openModal("#profile-modal");
  }
  $("#form-change-password")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      current_password: fd.get("current_password"),
      new_password: fd.get("new_password"),
    };
    try {
      await api("/api/auth/change-password", { method: "POST", body: JSON.stringify(body) });
      $("#profile-alert").textContent = "";
      toast("Password updated.", "ok");
      e.target.reset();
      closeModal("#profile-modal");
    } catch (err) {
      const al = $("#profile-alert");
      al.textContent = err.message || "Could not update password.";
      al.className = "alert err show";
    }
  });

  function setAlert(sel, msg, ok = false) {
    const el = $(sel);
    el.textContent = msg || "";
    el.classList.toggle("ok", !!ok);
    el.classList.toggle("show", !!msg);
  }

  $("#form-register")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("#reg-alert", "");
    const f = e.target;
    const u = f.username.value.trim();
    const p1 = f.password.value;
    const p2 = f.password2.value;
    if (p1 !== p2) return setAlert("#reg-alert", "Passwords do not match.");
    try {
      state.me = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: u, password: p1 }),
      });
      renderAuth();
      closeModal("#auth-modal");
      toast(`Welcome to MonoLit, ${state.me.username}!`, "ok");
      f.reset();
    } catch (err) {
      setAlert("#reg-alert", err.message);
    }
  });

  $("#form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("#login-alert", "");
    const f = e.target;
    try {
      state.me = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: f.username.value.trim(), password: f.password.value }),
      });
      renderAuth();
      closeModal("#auth-modal");
      toast(`Welcome back, ${state.me.username}.`, "ok");
      f.reset();
    } catch (err) {
      setAlert("#login-alert", err.message);
    }
  });

  // First-visit prompt to register (delayed, dismissable)
  function promptRegisterOnce() {
    if (sessionStorage.getItem("monolit:promptShown")) return;
    sessionStorage.setItem("monolit:promptShown", "1");
    setTimeout(() => {
      if (state.me) return;
      openModal("#auth-modal");
    }, 2200);
  }

  // ---------- Support form ----------
  $("#support-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("#support-alert", "");
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api("/api/support", { method: "POST", body: JSON.stringify(payload) });
      setAlert("#support-alert", "Ticket received. We'll reply via the contact you provided.", true);
      e.target.reset();
      toast("Support ticket submitted.", "ok");
    } catch (err) {
      setAlert("#support-alert", err.message);
    }
  });

  // ---------- Admin ----------
  $("#btn-admin")?.addEventListener("click", () => {
    if (!state.me || (state.me.role !== "Dev" && state.me.role !== "Owner")) return;
    if (!$("#admin-modal")) {
      // Page doesn't include the admin console (e.g. /download); jump home.
      window.location.href = "/?admin=1";
      return;
    }
    const tag = $("#admin-role-tag");
    if (tag) {
      tag.textContent = state.me.role;
      tag.className = "role " + state.me.role;
    }
    // Owner-only tabs
    $$("#admin-tabs button").forEach((b) => {
      if (b.dataset.ownerOnly !== undefined) {
        b.style.display = state.me.role === "Owner" ? "" : "none";
      }
    });
    openModal("#admin-modal");
    loadLauncherState();
    loadBroadcasts();
  });
  if ($("#admin-tabs") && $("#admin-modal")) {
    bindTabs($("#admin-tabs"), $("#admin-modal"));
  }
  // Auto-open admin modal when redirected from another page with ?admin=1.
  if (location.search.includes("admin=1") && $("#btn-admin")) {
    const openWhenReady = () => {
      if (state.me && (state.me.role === "Dev" || state.me.role === "Owner")) {
        $("#btn-admin").click();
        // Clean up the URL so a refresh doesn't keep re-opening it.
        const url = new URL(window.location.href);
        url.searchParams.delete("admin");
        window.history.replaceState({}, "", url.toString());
      } else {
        setTimeout(openWhenReady, 200);
      }
    };
    setTimeout(openWhenReady, 400);
  }

  async function loadLauncherState() {
    const s = await api("/api/launcher/state");
    state.launcher = s;
    if ($("#ls-online")) $("#ls-online").checked = s.online;
    if ($("#ls-downloads")) $("#ls-downloads").checked = s.downloads_enabled;
    if ($("#ls-msg")) $("#ls-msg").value = s.status_message || "";
    if ($("#ls-monolit")) $("#ls-monolit").checked = s.monolit_lite_enabled !== false;
    if ($("#ls-fabric")) $("#ls-fabric").checked = s.fabric_enabled !== false;
    if ($("#ls-express")) $("#ls-express").checked = s.express_enabled !== false;
    if ($("#ls-maintenance")) $("#ls-maintenance").checked = !!s.maintenance_mode;
    if ($("#ls-maint-msg")) $("#ls-maint-msg").value = s.maintenance_message || "";
    renderLauncher();
  }
  async function saveLauncherPatch(payload, okMsg) {
    try {
      const updated = await api("/api/admin/launcher", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.launcher = updated;
      // Re-sync UI in case the server normalized any value.
      if ($("#ls-online")) $("#ls-online").checked = updated.online;
      if ($("#ls-downloads")) $("#ls-downloads").checked = updated.downloads_enabled;
      if ($("#ls-msg")) $("#ls-msg").value = updated.status_message || "";
      if ($("#ls-monolit")) $("#ls-monolit").checked = updated.monolit_lite_enabled !== false;
      if ($("#ls-fabric")) $("#ls-fabric").checked = updated.fabric_enabled !== false;
      if ($("#ls-express")) $("#ls-express").checked = updated.express_enabled !== false;
      if ($("#ls-maintenance")) $("#ls-maintenance").checked = !!updated.maintenance_mode;
      if ($("#ls-maint-msg")) $("#ls-maint-msg").value = updated.maintenance_message || "";
      renderLauncher();
      toast(okMsg, "ok");
    } catch (err) { toast(err.message, "err"); }
  }
  $("#ls-save")?.addEventListener("click", () => {
    saveLauncherPatch({
      online: $("#ls-online").checked,
      downloads_enabled: $("#ls-downloads").checked,
      status_message: $("#ls-msg").value,
    }, "Launcher state updated.");
  });
  $("#ls-save-mods")?.addEventListener("click", () => {
    saveLauncherPatch({
      monolit_lite_enabled: $("#ls-monolit").checked,
      fabric_enabled: $("#ls-fabric").checked,
      express_enabled: $("#ls-express").checked,
    }, "Per-mod download switches saved.");
  });
  $("#ls-save-maint")?.addEventListener("click", () => {
    const msg = $("#ls-maint-msg").value.trim();
    saveLauncherPatch({
      maintenance_mode: $("#ls-maintenance").checked,
      maintenance_message: msg || "Site maintenance in progress. We'll be back shortly.",
    }, $("#ls-maintenance").checked
      ? "Maintenance mode ENABLED. Visitors now see the maintenance page."
      : "Maintenance mode disabled. Site is live again.");
  });

  async function loadBroadcasts() {
    const list = await api("/api/announcements");
    const feed = $("#bc-feed");
    feed.innerHTML = "";
    if (!list || !list.length) {
      feed.innerHTML = '<div style="color:var(--text-dim);">No broadcasts yet.</div>';
      return;
    }
    list.forEach((a) => {
      const m = document.createElement("div");
      m.className = "msg";
      const when = new Date(a.created_at).toLocaleString();
      const canDelete = state.me && (state.me.role === "Dev" || state.me.role === "Owner");
      m.innerHTML = `
        <span class="author">${a.author_role}/${escapeHtml(a.author_username)}</span>
        ${escapeHtml(a.body)}
        <span class="time">${when}</span>
        ${canDelete ? `<button class="mc-btn xs" data-del="${a.id}" style="margin-left:8px;">delete</button>` : ""}
      `;
      feed.appendChild(m);
    });
    $$("[data-del]", feed).forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this broadcast?")) return;
        try {
          await api(`/api/admin/announce/${b.dataset.del}`, { method: "DELETE" });
          loadBroadcasts(); refreshAnnouncements();
        } catch (err) { toast(err.message, "err"); }
      })
    );
  }
  $("#bc-send")?.addEventListener("click", async () => {
    const body = $("#bc-body").value.trim();
    if (!body) { toast("Write a message first.", "err"); return; }
    try {
      await api("/api/admin/announce", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      $("#bc-body").value = "";
      toast("Broadcast sent.", "ok");
      loadBroadcasts();
      refreshAnnouncements();
    } catch (err) { toast(err.message, "err"); }
  });

  async function loadUsers() {
    let users = [];
    try { users = await api("/api/admin/users"); }
    catch (err) { toast(err.message, "err"); return; }
    const tbody = $("#users-tbl tbody");
    tbody.innerHTML = "";
    users.forEach((u) => {
      const tr = document.createElement("tr");
      const joined = new Date(u.created_at).toLocaleDateString();
      const seen = u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : "—";
      const status = u.is_banned ? `<span style="color:var(--redstone);">BANNED</span>` : `<span style="color:var(--xp);">active</span>`;
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}</td>
        <td><span class="role ${u.role}">${u.role}</span></td>
        <td>${status}${u.ban_reason ? `<div style="font-size:13px;color:var(--text-dim);">${escapeHtml(u.ban_reason)}</div>` : ""}</td>
        <td>${joined}</td>
        <td>${seen}</td>
        <td class="row-actions"></td>`;
      const actions = $(".row-actions", tr);

      const isMe = state.me && state.me.id === u.id;
      const canBan = !isMe && u.role !== "Owner" && (state.me.role === "Owner" || (state.me.role === "Dev" && u.role !== "Dev"));
      if (canBan) {
        const btn = document.createElement("button");
        btn.className = "mc-btn xs " + (u.is_banned ? "primary" : "redstone");
        btn.textContent = u.is_banned ? "Unban" : "Ban";
        btn.addEventListener("click", async () => {
          let reason = null;
          if (!u.is_banned) {
            reason = prompt("Ban reason (optional):", "");
            if (reason === null) return;
          }
          try {
            await api(`/api/admin/users/${u.id}/ban`, {
              method: "POST",
              body: JSON.stringify({ banned: !u.is_banned, reason }),
            });
            loadUsers();
          } catch (err) { toast(err.message, "err"); }
        });
        actions.appendChild(btn);
      }
      if (state.me.role === "Owner" && !isMe && u.role !== "Owner") {
        const sel = document.createElement("select");
        ["User", "Dev", "Owner"].forEach((r) => {
          const o = document.createElement("option");
          o.value = r; o.textContent = r; if (r === u.role) o.selected = true;
          sel.appendChild(o);
        });
        sel.style.maxWidth = "100px";
        sel.addEventListener("change", async () => {
          try {
            await api(`/api/admin/users/${u.id}/role`, {
              method: "POST",
              body: JSON.stringify({ role: sel.value }),
            });
            loadUsers();
          } catch (err) { toast(err.message, "err"); loadUsers(); }
        });
        actions.appendChild(sel);
      }
      if (state.me.role === "Owner" && !isMe && u.role !== "Owner") {
        const del = document.createElement("button");
        del.className = "mc-btn xs";
        del.textContent = "Delete";
        del.addEventListener("click", async () => {
          if (!confirm(`Permanently delete ${u.username}?`)) return;
          try {
            await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
            loadUsers();
          } catch (err) { toast(err.message, "err"); }
        });
        actions.appendChild(del);
      }

      // Password change permission: Owner can issue to any non-self user.
      // Dev can issue to plain Users only. Permission lasts 30 minutes
      // and the target user supplies the new password themselves.
      const canResetPwd = !isMe && (
        state.me.role === "Owner" ||
        (state.me.role === "Dev" && u.role === "User")
      );
      if (canResetPwd) {
        const reset = document.createElement("button");
        reset.className = "mc-btn xs";
        reset.textContent = "Reset password";
        reset.title = "Send a password-change permission to this user. They confirm and pick the new password.";
        reset.addEventListener("click", async () => {
          if (!confirm(`Send a password-change request to ${u.username}? They will see a banner and pick the new password themselves.`)) return;
          try {
            const perm = await api(`/api/admin/users/${u.id}/password-permission`, { method: "POST" });
            toast(`Permission sent to ${u.username}. Status: ${perm.status}.`, "ok", 5000);
            loadUsers();
          } catch (err) { toast(err.message, "err", 5000); }
        });
        actions.appendChild(reset);
      }
      tbody.appendChild(tr);
    });
  }

  $("#create-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("#create-alert", "");
    const f = e.target;
    try {
      await api("/api/admin/accounts", {
        method: "POST",
        body: JSON.stringify({
          username: f.username.value.trim(),
          password: f.password.value,
          role: f.role.value,
        }),
      });
      f.reset();
      setAlert("#create-alert", "Account created.", true);
      loadUsers();
      toast("Account created.", "ok");
    } catch (err) { setAlert("#create-alert", err.message); }
  });

  async function loadTickets() {
    let tickets = [];
    try { tickets = await api("/api/admin/tickets"); }
    catch (err) { toast(err.message, "err"); return; }
    const wrap = $("#tickets-list");
    wrap.innerHTML = "";
    if (!tickets.length) {
      wrap.innerHTML = '<div style="color:var(--text-dim);">No tickets yet.</div>';
      return;
    }
    tickets.forEach((t) => {
      const el = document.createElement("div");
      el.style.cssText = "border:3px solid var(--pane-border);background:rgba(0,0,0,0.3);padding:14px;";
      const when = new Date(t.created_at).toLocaleString();
      el.innerHTML = `
        <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;">
          <span class="pixel" style="font-size:11px;color:var(--gold);">${escapeHtml(t.subject)}</span>
          <span style="font-size:14px;color:var(--text-dim);">#${t.id} · ${when} · ${escapeHtml(t.author_username)} &lt;${escapeHtml(t.contact)}&gt;</span>
        </div>
        <div style="margin-top:8px;font-size:18px;white-space:pre-wrap;">${escapeHtml(t.body)}</div>
      `;
      wrap.appendChild(el);
    });
  }

  // ---------- Password change permission (target side) ----------
  // A staff member can grant this user a "permission slip" to change their
  // password. We poll for it on every page; when one arrives, show a modal
  // with Accept / Decline. On Accept, the user types the new password
  // themselves (admin never sees it).
  const pwdPerm = {
    current: null,
    declined: new Set(),
  };

  function formatExpiresIn(iso) {
    if (!iso) return "soon";
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "now";
    const mins = Math.round(ms / 60000);
    if (mins < 1) return "in <1 min";
    if (mins === 1) return "in 1 minute";
    return `in ${mins} minutes`;
  }

  function showPwdPermModal(perm) {
    const grantor = $("#pwdperm-grantor");
    const role = $("#pwdperm-grantor-role");
    const expires = $("#pwdperm-expires");
    if (grantor) grantor.textContent = perm.granted_by_username;
    if (role) {
      role.textContent = perm.granted_by_role;
      role.className = "role " + perm.granted_by_role;
    }
    if (expires) expires.textContent = formatExpiresIn(perm.expires_at);
    const decision = $("#pwdperm-stage-decision");
    const form = $("#form-pwdperm-set");
    if (decision) decision.hidden = false;
    if (form) {
      form.hidden = true;
      form.reset();
    }
    const al = $("#pwdperm-alert");
    if (al) al.textContent = "";
    openModal("#pwdperm-modal");
  }

  async function refreshPwdPerm() {
    if (!state.me) {
      pwdPerm.current = null;
      return;
    }
    let perm = null;
    try {
      perm = await api("/api/auth/password-permission");
    } catch (_) { return; }
    if (!perm) {
      pwdPerm.current = null;
      return;
    }
    if (pwdPerm.declined.has(perm.id)) return;
    if (pwdPerm.current && pwdPerm.current.id === perm.id) return;
    pwdPerm.current = perm;
    const modal = $("#pwdperm-modal");
    if (!modal) return;
    showPwdPermModal(perm);
  }

  $("#pwdperm-accept")?.addEventListener("click", () => {
    const decision = $("#pwdperm-stage-decision");
    const form = $("#form-pwdperm-set");
    if (decision) decision.hidden = true;
    if (form) form.hidden = false;
    const al = $("#pwdperm-alert");
    if (al) al.textContent = "";
  });

  $("#pwdperm-cancel")?.addEventListener("click", () => {
    const decision = $("#pwdperm-stage-decision");
    const form = $("#form-pwdperm-set");
    if (form) form.hidden = true;
    if (decision) decision.hidden = false;
  });

  $("#pwdperm-decline")?.addEventListener("click", async () => {
    try {
      await api("/api/auth/password-permission/decline", { method: "POST" });
      if (pwdPerm.current) pwdPerm.declined.add(pwdPerm.current.id);
      pwdPerm.current = null;
      closeModal("#pwdperm-modal");
      toast("Password change request declined.", "info");
    } catch (err) {
      toast(err.message, "err");
    }
  });

  $("#form-pwdperm-set")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const al = $("#pwdperm-alert");
    if (al) al.textContent = "";
    const p1 = f.new_password.value;
    const p2 = f.confirm_password.value;
    if (p1 !== p2) {
      if (al) al.textContent = "Passwords do not match.";
      return;
    }
    try {
      await api("/api/auth/password-permission/accept", {
        method: "POST",
        body: JSON.stringify({ new_password: p1 }),
      });
      pwdPerm.current = null;
      closeModal("#pwdperm-modal");
      f.reset();
      toast("Password updated.", "ok", 4500);
    } catch (err) {
      if (al) al.textContent = err.message;
    }
  });

  // ---------- Misc helpers ----------
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // ---------- Main ----------
  document.getElementById("year").textContent = new Date().getFullYear();
  spawnParticles();
  buildFarm();
  setupReveal();
  setupNav();

  Promise.all([refreshMe(), refreshLauncher(), refreshAnnouncements()])
    .finally(async () => {
      await runBootLoader();
      animateCounters();
      promptRegisterOnce();
      // Initial password-permission check after we know who we are.
      refreshPwdPerm();
      // Background polling so banned/role changes / launcher toggles propagate
      setInterval(refreshLauncher, 15000);
      setInterval(refreshAnnouncements, 20000);
      setInterval(refreshMe, 30000);
      setInterval(refreshPwdPerm, 10000);
    });

  $("#footer-changelog")?.addEventListener("click", (e) => {
    e.preventDefault();
    toast("v1.0.2A · Bedrock placement on slabs · Wheat farm schematic added · Donut server profile.", "info", 5000);
  });
  $("#footer-status")?.addEventListener("click", (e) => {
    e.preventDefault();
    toast(`${state.launcher.online ? "Online" : "Offline"} — ${state.launcher.status_message}`, state.launcher.online ? "ok" : "err", 5000);
  });
})();
