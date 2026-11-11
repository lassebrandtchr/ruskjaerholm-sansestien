(function () {
  "use strict";
  document.documentElement.classList.add("js");
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var data = window.STATIONER || [];
  var liste = document.getElementById("stationer");
  var reduceret = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function erFri(s) { return s.visning === "fritlagt-klar"; }
  function erBred(s) { return erFri(s) && s.bredde / s.hoejde > 1.15; }

  // ---------- Stationer ----------
  data.forEach(function (s, i) {
    var li = document.createElement("li");
    li.className = "station" + (erFri(s) ? " station--fri" : "") + (erBred(s) ? " station--bred" : "");
    li.id = "station-" + s.nr;
    li.innerHTML =
      '<button class="station__knap" type="button" data-i="' + i + '">' +
        '<span class="station__ramme"><img src="' + s.billede + '" alt="' + esc(s.titel) + '" loading="lazy" width="' + (s.bredde || 800) + '" height="' + (s.hoejde || 1000) + '"></span>' +
        '<span class="station__pael" aria-hidden="true">' + s.nr + '</span>' +
        '<span class="station__titel"><span class="sr">Station ' + s.nr + ': </span>' + esc(s.titel) + '</span>' +
        '<span class="station__se">Se og læs <span aria-hidden="true">→</span></span>' +
      '</button>';
    liste.appendChild(li);
  });

  // Indtoning
  var stationer = liste.querySelectorAll(".station");
  var vis = [].slice.call(stationer);
  if ("IntersectionObserver" in window && !reduceret) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) e.target.classList.add("er-set");
        else if (e.boundingClientRect.top > 0) e.target.classList.remove("er-set"); // kun når den forsvinder ud i bunden
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    vis.forEach(function (el) { io.observe(el); });
  } else {
    vis.forEach(function (el) { el.classList.add("er-set"); });
  }

  // ---------- Stien (SVG der tegnes mens man scroller) ----------
  var bane = document.querySelector(".sti__bane");
  var svg = document.querySelector(".sti__svg");
  var grus = svg.querySelector(".sti__grus");
  var spor = svg.querySelector(".sti__spor");
  var gaaer = svg.querySelector(".sti__gaaer");
  var laengde = 0;

  function tegnSti() {
    var w = bane.offsetWidth, h = bane.offsetHeight;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    var pts = [[w / 2, 24]];
    stationer.forEach(function (el, i) {
      var y = liste.offsetTop + el.offsetTop + el.offsetHeight / 2;
      var x = i % 2 === 0 ? w * 0.86 : w * 0.14;
      pts.push([x, y]);
    });
    pts.push([w / 2, h]);
    var d = "M" + pts[0][0] + " " + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 1], p1 = pts[i], my = (p0[1] + p1[1]) / 2;
      d += " C" + p0[0] + " " + my + " " + p1[0] + " " + my + " " + p1[0] + " " + p1[1];
    }
    grus.setAttribute("d", d);
    spor.setAttribute("d", d);
    laengde = grus.getTotalLength();
    grus.style.strokeDasharray = laengde;
    // Opslagstabel: længde -> y, så prikken kan følge skærmhøjden og ikke stiens længde
    tabelY = [];
    tabelL = [];
    var trin = Math.max(1, Math.ceil(laengde / 6));
    for (var k = 0; k <= trin; k++) {
      var l = laengde * k / trin;
      tabelL.push(l);
      tabelY.push(grus.getPointAtLength(l).y);
    }
    opdater();
  }
  var tabelY = [], tabelL = [];

  // Find stedet på stien hvor y = maal (stien går altid nedad, så y er stigende)
  function laengdeVedY(y) {
    var n = tabelY.length;
    if (!n) return 0;
    if (y <= tabelY[0]) return 0;
    if (y >= tabelY[n - 1]) return laengde;
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (tabelY[mid] < y) lo = mid; else hi = mid;
    }
    var dy = tabelY[hi] - tabelY[lo];
    var f = dy > 0 ? (y - tabelY[lo]) / dy : 0;
    return tabelL[lo] + f * (tabelL[hi] - tabelL[lo]);
  }

  var venter = false;
  function opdater() {
    venter = false;
    if (!laengde) return;
    var b = bane.getBoundingClientRect();
    var maal = window.innerHeight * 0.6 - b.top;
    var l = reduceret ? laengde : laengdeVedY(maal);
    grus.style.strokeDashoffset = laengde - l;
    var p = grus.getPointAtLength(l);
    gaaer.setAttribute("cx", p.x);
    gaaer.setAttribute("cy", p.y);
  }
  window.addEventListener("scroll", function () { if (!venter) { venter = true; requestAnimationFrame(opdater); } }, { passive: true });
  var sidstBredde = innerWidth;
  window.addEventListener("resize", function () { if (innerWidth !== sidstBredde) { sidstBredde = innerWidth; tegnSti(); } });
  window.addEventListener("load", tegnSti);
  if ("ResizeObserver" in window) new ResizeObserver(tegnSti).observe(liste);
  tegnSti();

  // ---------- Stationskort ----------
  var kort = document.getElementById("kort");
  var kFlade = kort.querySelector(".kort__flade");
  var kTop = kort.querySelector(".kort__top");
  var kNav = kort.querySelector(".kort__nav");
  var kNr = document.getElementById("kort-nr");
  var kFig = kort.querySelector(".kort__fig");
  var kImg = document.getElementById("kort-img");
  var kTitel = document.getElementById("kort-titel");
  var kTekst = document.getElementById("kort-tekst");
  var kIndhold = document.getElementById("kort-indhold");
  var forrige = document.getElementById("kort-forrige");
  var naeste = document.getElementById("kort-naeste");
  var aktiv = 0, travl = false;
  var BLOED = "cubic-bezier(.22,1,.36,1)";

  function vent(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function faerdig(a) { return a ? a.finished.catch(function () {}) : Promise.resolve(); }
  function anim(el, kf, o) { return el.animate(kf, Object.assign({ fill: "both" }, o)); }
  function klar(img) {
    var p = img.decode ? img.decode().catch(function () {}) : new Promise(function (r) { if (img.complete) r(); else img.onload = img.onerror = r; });
    return Promise.race([p, vent(900)]);
  }
  function bagtaeppe(fra, til, o) {
    try { kort.animate([{ opacity: fra }, { opacity: til }], Object.assign({ pseudoElement: "::backdrop", fill: "both" }, o)); } catch (e) {}
  }

  function udfyld(i) {
    aktiv = i;
    var s = data[i];
    kNr.textContent = "Station " + s.nr + " af " + data.length;
    kImg.src = s.kort || s.original || s.billede;
    kImg.alt = s.titel;
    kTitel.textContent = s.titel + (s.emoji ? " " + s.emoji : "");
    var tekst = s.tekst.replace(/[“”"]/g, "").trim();
    var titel = s.titel.replace(/[“”"]/g, "").trim();
    kTekst.textContent = tekst.toLowerCase() === titel.toLowerCase() ? "" : s.tekst;
    kTekst.hidden = !kTekst.textContent;
    forrige.disabled = i === 0;
    naeste.disabled = i === data.length - 1;
    kIndhold.scrollTop = 0;
    [i + 1, i - 1].forEach(function (k) { if (data[k]) { var pre = new Image(); pre.src = data[k].kort || data[k].original; } });
  }

  function aabn(i) {
    if (travl) return;
    udfyld(i);
    if (typeof kort.showModal === "function") kort.showModal(); else kort.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    history.pushState({ kort: true }, "");
    if (reduceret) return;
    travl = true;
    // Roligt: fladen toner frem, billedet folder sig blødt ud, teksten løfter sig forskudt
    anim(kFlade, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: "ease-out" });
    bagtaeppe(0, 1, { duration: 380, easing: "ease-out" });
    anim(kTop, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 120, easing: "ease-out" });
    anim(kNav, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: 260, easing: BLOED });
    kFig.style.opacity = "0";
    klar(kImg).then(function () {
      kFig.style.opacity = "";
      anim(kFig, [{ opacity: 0, transform: "translateY(22px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 720, delay: 200, easing: BLOED });
      [kTitel, kTekst].forEach(function (el, k) {
        anim(el, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 640, delay: 340 + k * 90, easing: BLOED });
      });
      return vent(700);
    }).then(function () { travl = false; });
  }

  // Forrige/Næste: indholdet glider ud til den ene side og det nye ind fra den anden
  function skift(i) {
    if (i < 0 || i >= data.length || travl) return;
    if (reduceret) { udfyld(i); return; }
    travl = true;
    var ret = i > aktiv ? 1 : -1;
    var dele = [kFig, kTitel, kTekst];
    var ud = dele.map(function (el, k) {
      return anim(el, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + (-ret * 44) + "px)" }], { duration: 220, delay: k * 30, easing: "cubic-bezier(.4,0,1,1)" });
    });
    Promise.all(ud.map(faerdig)).then(function () {
      udfyld(i);
      return klar(kImg);
    }).then(function () {
      dele.forEach(function (el, k) {
        anim(el, [{ opacity: 0, transform: "translateX(" + (ret * 56) + "px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: k * 60, easing: BLOED });
      });
      return vent(400);
    }).then(function () { travl = false; });
  }

  function erAaben() { return kort.hasAttribute("open"); }
  function lukDialog() {
    if (typeof kort.close === "function") kort.close();
    else { kort.removeAttribute("open"); kort.dispatchEvent(new Event("close")); }
  }
  function nulstil() {
    kort.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); });
    kImg.style.opacity = "";
    kFig.style.opacity = "";
  }

  var lukker = false;
  function luk() {
    if (!erAaben() || lukker) return;
    var el = document.getElementById("station-" + data[aktiv].nr);
    if (reduceret) { lukDialog(); return; }
    lukker = true; travl = true;
    if (el) { el.classList.add("er-set"); el.scrollIntoView({ block: "center", behavior: "instant" }); }
    var UD = "cubic-bezier(.4,0,.7,.2)";
    anim(kIndhold, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(14px)" }], { duration: 260, easing: UD });
    anim(kNav, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: UD });
    anim(kTop, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 60, easing: UD });
    bagtaeppe(1, 0, { duration: 340, delay: 160, easing: "ease-in-out" });
    faerdig(anim(kFlade, [{ opacity: 1 }, { opacity: 0 }], { duration: 340, delay: 160, easing: "ease-in-out" })).then(lukDialog);
  }

  kort.addEventListener("close", function () {
    document.body.style.overflow = "";
    nulstil();
    lukker = false; travl = false;
    if (history.state && history.state.kort) history.back();
    var el = document.getElementById("station-" + data[aktiv].nr);
    if (el) { var knap = el.querySelector("button"); if (knap) knap.focus({ preventScroll: true }); }
  });
  kort.addEventListener("cancel", function (e) { e.preventDefault(); luk(); });

  window.addEventListener("popstate", function () { if (erAaben()) luk(); });

  liste.addEventListener("click", function (e) {
    var knap = e.target.closest(".station__knap");
    if (knap) aabn(+knap.dataset.i);
  });
  document.getElementById("kort-luk").addEventListener("click", luk);
  forrige.addEventListener("click", function () { skift(aktiv - 1); });
  naeste.addEventListener("click", function () { skift(aktiv + 1); });
  kort.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") skift(aktiv + 1);
    if (e.key === "ArrowLeft") skift(aktiv - 1);
  });

  var sx = 0, sy = 0;
  kIndhold.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  kIndhold.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) skift(aktiv + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();
