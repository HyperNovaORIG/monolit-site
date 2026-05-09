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
  $("#btn-login").addEventListener("click", () => {
    $$("#auth-tabs button").forEach((t) => t.classList.toggle("active", t.dataset.tab === "login"));
    $("#form-register").classList.remove("active");
    $("#form-login").classList.add("active");
    openModal("#auth-modal");
  });
  $("#btn-register").addEventListener("click", () => {
    $$("#auth-tabs button").forEach((t) => t.classList.toggle("active", t.dataset.tab === "register"));
    $("#form-register").classList.add("active");
    $("#form-login").classList.remove("active");
    openModal("#auth-modal");
  });
  $("#btn-logout").addEventListener("click", async () => {
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
  $("#form-change-password").addEventListener("submit", async (e) => {
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

  $("#form-register").addEventListener("submit", async (e) => {
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

  $("#form-login").addEventListener("submit", async (e) => {
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

  // ---------- Download ----------
  const dlSteps = [
    "Connecting to mirror…",
    "Verifying SHA-256…",
    "Pulling block registry…",
    "Compiling Yarn mappings 1.21.11…",
    "Cross-checking Fabric API compatibility…",
    "Packing schematics into jar…",
    "Almost done…",
    "Finalizing artifact…",
  ];
  $("#btn-download-lite").addEventListener("click", async () => {
    if (!state.launcher.online || !state.launcher.downloads_enabled) {
      toast("Downloads are temporarily disabled. Try again later.", "err");
      return;
    }
    openModal("#download-modal");
    const fill = $("#dl-fill"), pct = $("#dl-pct"), step = $("#dl-step");
    fill.style.width = "0%"; pct.textContent = "0%"; step.textContent = dlSteps[0];
    let p = 0, idx = 0;
    await new Promise((resolve) => {
      const tick = () => {
        const inc = 3 + Math.random() * 9;
        p = Math.min(100, p + inc);
        fill.style.width = p + "%";
        pct.textContent = Math.floor(p) + "%";
        if (Math.random() < 0.55) {
          idx = (idx + 1) % dlSteps.length;
          step.textContent = dlSteps[idx];
        }
        if (p < 100) setTimeout(tick, 160 + Math.random() * 220);
        else resolve();
      };
      tick();
    });
    step.textContent = "Sending file…";
    // Real download
    try {
      const res = await fetch(apiUrl("/api/download/lite"), { credentials: "same-origin" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.detail) || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "MonoLit-Lite-1.0.2A.jar";
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
      toast("MonoLit Lite downloaded. Drop it in your mods/ folder!", "ok", 5000);
    } catch (err) {
      toast(err.message, "err", 5000);
    }
    setTimeout(() => closeModal("#download-modal"), 600);
  });

  // ---------- Support form ----------
  $("#support-form").addEventListener("submit", async (e) => {
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
  $("#btn-admin").addEventListener("click", () => {
    if (!state.me || (state.me.role !== "Dev" && state.me.role !== "Owner")) return;
    const tag = $("#admin-role-tag");
    tag.textContent = state.me.role;
    tag.className = "role " + state.me.role;
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
  bindTabs($("#admin-tabs"), $("#admin-modal"));

  async function loadLauncherState() {
    const s = await api("/api/launcher/state");
    state.launcher = s;
    $("#ls-online").checked = s.online;
    $("#ls-downloads").checked = s.downloads_enabled;
    $("#ls-msg").value = s.status_message || "";
    renderLauncher();
  }
  $("#ls-save").addEventListener("click", async () => {
    try {
      const updated = await api("/api/admin/launcher", {
        method: "POST",
        body: JSON.stringify({
          online: $("#ls-online").checked,
          downloads_enabled: $("#ls-downloads").checked,
          status_message: $("#ls-msg").value,
        }),
      });
      state.launcher = updated;
      renderLauncher();
      toast("Launcher state updated.", "ok");
    } catch (err) { toast(err.message, "err"); }
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
  $("#bc-send").addEventListener("click", async () => {
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
      tbody.appendChild(tr);
    });
  }

  $("#create-form").addEventListener("submit", async (e) => {
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
      // Background polling so banned/role changes / launcher toggles propagate
      setInterval(refreshLauncher, 15000);
      setInterval(refreshAnnouncements, 20000);
      setInterval(refreshMe, 30000);
    });

  $("#footer-changelog").addEventListener("click", (e) => {
    e.preventDefault();
    toast("v1.0.2A · Bedrock placement on slabs · Wheat farm schematic added · Donut server profile.", "info", 5000);
  });
  $("#footer-status").addEventListener("click", (e) => {
    e.preventDefault();
    toast(`${state.launcher.online ? "Online" : "Offline"} — ${state.launcher.status_message}`, state.launcher.online ? "ok" : "err", 5000);
  });
})();
