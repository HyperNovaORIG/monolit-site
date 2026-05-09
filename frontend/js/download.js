/* MonoLit — download page logic */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Tiny local fetch helper (app.js's `api()` lives in a module closure and
  // isn't exposed; we duplicate the minimum we need).
  function apiUrl(path) {
    if (/^https?:/i.test(path)) return path;
    return window.location.origin + (path.startsWith("/") ? path : "/" + path);
  }
  async function getState() {
    const res = await fetch(apiUrl("/api/launcher/state"), { credentials: "same-origin" });
    if (!res.ok) throw new Error("Failed to load launcher state");
    return res.json();
  }

  // Toast helper compatible with the markup in download.html.
  function localToast(msg, kind = "info", ttl = 3500) {
    const wrap = document.getElementById("toast-wrap");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.4s, transform 0.4s";
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      setTimeout(() => el.remove(), 450);
    }, ttl);
  }

  // ---------- Apply admin disable flags to UI ----------
  async function syncDisabledFlags() {
    let s;
    try { s = await getState(); } catch (_) { return; }
    // Master switch overrides individual.
    const masterOff = !s.online || !s.downloads_enabled;

    function setSlot(slot, enabled) {
      const card = document.querySelector(`#card-${slot}`);
      const btn = document.querySelector(`#btn-download-${slot}`);
      const flag = document.querySelector(`.dl-card-disabled[data-slot="${slot}"]`);
      if (!card || !btn || !flag) return;
      if (enabled) {
        card.classList.remove("dl-disabled");
        btn.disabled = false;
        flag.hidden = true;
      } else {
        card.classList.add("dl-disabled");
        btn.disabled = true;
        flag.hidden = false;
      }
    }

    setSlot("monolit", !masterOff && s.monolit_lite_enabled);
    setSlot("fabric",  !masterOff && s.fabric_enabled);

    const expressOff =
      masterOff || !s.express_enabled ||
      !s.monolit_lite_enabled || !s.fabric_enabled;
    const expressBtn = document.querySelector("#btn-express");
    const expressFlag = document.querySelector("#express-disabled");
    const expressCard = document.querySelector("#express-card");
    if (expressBtn && expressFlag && expressCard) {
      if (expressOff) {
        expressCard.classList.add("dl-disabled");
        expressBtn.disabled = true;
        expressFlag.hidden = false;
        const txt = document.querySelector("#express-disabled-text");
        if (txt) {
          txt.textContent = !s.online
            ? "Launcher is currently offline."
            : !s.downloads_enabled
            ? "Downloads are temporarily disabled by an admin."
            : !s.express_enabled
            ? "Express download has been temporarily disabled by an admin."
            : !s.monolit_lite_enabled
            ? "MonoLit Lite is disabled — Express needs both files."
            : "fabric-1.21.11.jar is disabled — Express needs both files.";
        }
      } else {
        expressCard.classList.remove("dl-disabled");
        expressBtn.disabled = false;
        expressFlag.hidden = true;
      }
    }
  }
  syncDisabledFlags();
  setInterval(syncDisabledFlags, 15000);

  // ---------- Real download helper ----------
  async function downloadFile(slot, filename) {
    const res = await fetch(apiUrl(`/api/download/${slot}`), { credentials: "same-origin" });
    if (!res.ok) {
      let detail = `Download failed (${res.status})`;
      try { const data = await res.json(); if (data && data.detail) detail = data.detail; } catch (_) {}
      throw new Error(detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  // ---------- Download progress modal helpers ----------
  function openModal(id) { const m = document.querySelector(id); if (m) m.classList.add("show"); }
  function closeModal(id) { const m = document.querySelector(id); if (m) m.classList.remove("show"); }

  async function fakeProgress(title, sub, total = 1500) {
    $("#dl-title").textContent = title;
    $("#dl-sub").textContent = sub;
    const fill = $("#dl-fill"), pct = $("#dl-pct"), step = $("#dl-step");
    fill.style.width = "0%"; pct.textContent = "0%";
    const steps = [
      "Connecting to mirror…",
      "Verifying SHA-256…",
      "Pulling artifacts…",
      "Almost done…",
      "Finalizing…",
    ];
    step.textContent = steps[0];
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const p = Math.min(100, (elapsed / total) * 100);
        fill.style.width = p + "%";
        pct.textContent = Math.floor(p) + "%";
        if (Math.random() < 0.4) step.textContent = steps[Math.floor(Math.random() * steps.length)];
        if (p < 100) requestAnimationFrame(tick);
        else resolve();
      };
      tick();
    });
  }

  // ---------- Individual buttons ----------
  $("#btn-download-monolit")?.addEventListener("click", async () => {
    openModal("#download-modal");
    try {
      await fakeProgress("Preparing MonoLit Lite…", "Pulling MonoLit-Lite-1.0.2A.jar from the server.", 1200);
      await downloadFile("monolit", "MonoLit-Lite-1.0.2A.jar");
      localToast("MonoLit Lite downloaded.", "ok", 4500);
    } catch (err) {
      localToast(err.message, "err", 5000);
    } finally {
      setTimeout(() => closeModal("#download-modal"), 600);
    }
  });

  $("#btn-download-fabric")?.addEventListener("click", async () => {
    openModal("#download-modal");
    try {
      await fakeProgress("Preparing fabric-1.21.11.jar…", "Pulling 16 MB jar from the server.", 1500);
      await downloadFile("fabric", "fabric-1.21.11.jar");
      localToast("fabric-1.21.11.jar downloaded.", "ok", 4500);
    } catch (err) {
      localToast(err.message, "err", 5000);
    } finally {
      setTimeout(() => closeModal("#download-modal"), 600);
    }
  });

  // ---------- Express ----------
  $("#btn-express")?.addEventListener("click", async () => {
    // Pre-flight: refuse early if admin disabled express.
    try {
      const res = await fetch(apiUrl("/api/download/express/check"), { credentials: "same-origin" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.detail) || "Express download is currently unavailable.");
      }
    } catch (err) {
      localToast(err.message, "err", 5000);
      syncDisabledFlags();
      return;
    }

    openModal("#download-modal");
    try {
      await fakeProgress("Express download…", "Bundling MonoLit Lite + fabric-1.21.11.jar.", 2000);

      // Open Modrinth Fabric API tab first — pop-up blockers tolerate this
      // when it happens directly inside a click handler.
      let fabricApiTab = null;
      try {
        fabricApiTab = window.open("https://modrinth.com/mod/fabric-api/versions?g=1.21.11&l=fabric", "_blank", "noopener");
      } catch (_) { /* */ }

      // Sequential downloads — browsers usually batch-allow files initiated
      // shortly after a user gesture.
      $("#dl-step").textContent = "Sending MonoLit-Lite-1.0.2A.jar…";
      await downloadFile("monolit", "MonoLit-Lite-1.0.2A.jar");
      await new Promise((r) => setTimeout(r, 350));
      $("#dl-step").textContent = "Sending fabric-1.21.11.jar…";
      await downloadFile("fabric", "fabric-1.21.11.jar");

      if (!fabricApiTab) {
        localToast("Pop-up blocked — open Fabric API on Modrinth manually.", "info", 6000);
      }
      localToast("Express download complete. Both jars saved!", "ok", 5500);
    } catch (err) {
      localToast(err.message, "err", 5000);
    } finally {
      setTimeout(() => closeModal("#download-modal"), 600);
    }
  });

  // ---------- Animated install guide ----------
  const ig = document.getElementById("install-guide");
  if (ig) {
    const scenes = $$(".ig-scene", ig);
    const tlButtons = $$(".ig-tl-step", ig);
    let current = 0;
    let timer = null;
    const AUTOPLAY_MS = 5500;

    function show(idx) {
      current = ((idx % scenes.length) + scenes.length) % scenes.length;
      scenes.forEach((s, i) => s.classList.toggle("active", i === current));
      tlButtons.forEach((b, i) => b.classList.toggle("active", i === current));
    }
    function next() { show(current + 1); }
    function prev() { show(current - 1); }
    function startAuto() {
      stopAuto();
      timer = setInterval(next, AUTOPLAY_MS);
    }
    function stopAuto() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    tlButtons.forEach((b) => b.addEventListener("click", () => {
      show(parseInt(b.dataset.step, 10) || 0);
      const auto = $("#ig-autoplay");
      if (auto && auto.checked) startAuto();
    }));
    $("#ig-prev")?.addEventListener("click", () => { prev(); const auto = $("#ig-autoplay"); if (auto && auto.checked) startAuto(); });
    $("#ig-next")?.addEventListener("click", () => { next(); const auto = $("#ig-autoplay"); if (auto && auto.checked) startAuto(); });
    $("#ig-autoplay")?.addEventListener("change", (e) => {
      if (e.target.checked) startAuto(); else stopAuto();
    });

    // Autoplay only when guide is on-screen (saves CPU and avoids surprises).
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const auto = $("#ig-autoplay");
          if (entry.isIntersecting && auto && auto.checked) startAuto();
          else stopAuto();
        });
      }, { threshold: 0.2 });
      io.observe(ig);
    } else {
      startAuto();
    }
  }
})();
