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
      entries.forEach(function (e) { if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add("er-set"); io.unobserve(e.target); } });
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
    opdater();
  }

  var venter = false;
  function opdater() {
    venter = false;
    if (!laengde) return;
    var b = bane.getBoundingClientRect();
    var maal = window.innerHeight * 0.6 - b.top;
    var andel = Math.max(0, Math.min(1, maal / b.height));
    if (reduceret) andel = 1;
    grus.style.strokeDashoffset = laengde * (1 - andel);
    var p = grus.getPointAtLength(laengde * andel);
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
  var aktiv = 0, travl = false, skjult = null, flyver = null;
  var BLOED = "cubic-bezier(.22,1,.36,1)";

  function vent(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function faerdig(a) { return a ? a.finished.catch(function () {}) : Promise.resolve(); }
  function anim(el, kf, o) { return el.animate(kf, Object.assign({ fill: "both" }, o)); }
  function klar(img) {
    var p = img.decode ? img.decode().catch(function () {}) : new Promise(function (r) { if (img.complete) r(); else img.onload = img.onerror = r; });
    return Promise.race([p, vent(900)]);
  }
  function stationImg(i) { var el = document.getElementById("station-" + data[i].nr); return el && el.querySelector(".station__ramme img"); }
  // Kasse for et billede med forholdet a, lagt "contain" ind i rect r
  function contain(r, a) {
    var w = r.width, h = w / a;
    if (h > r.height) { h = r.height; w = h * a; }
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  }
  function bagtaeppe(fra, til, o) {
    try { kort.animate([{ opacity: fra }, { opacity: til }], Object.assign({ pseudoElement: "::backdrop", fill: "both" }, o)); } catch (e) {}
  }
  function tilTransform(r, w) { return "translate(" + r.left + "px," + r.top + "px) scale(" + (r.width / w) + ")"; }
  function skjul(img) { if (skjult) skjult.style.opacity = ""; skjult = img; if (img) img.style.opacity = "0"; }

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

  // Lav en flyvende kopi af den fritlagte skulptur (ligger inde i dialogen, over alt andet)
  function nyFlyver(s) {
    var f = document.createElement("img");
    f.className = "flyver"; f.alt = ""; f.src = s.billede;
    f.style.width = s.bredde + "px"; f.style.height = s.hoejde + "px";
    kort.appendChild(f);
    return f;
  }
  function fjernFlyver() { if (flyver) { flyver.remove(); flyver = null; } }

  function aabn(i) {
    if (travl) return;
    var s = data[i], fri = erFri(s), kilde = stationImg(i);
    var fra = kilde ? contain(kilde.getBoundingClientRect(), s.bredde / s.hoejde) : null;
    udfyld(i);
    if (typeof kort.showModal === "function") kort.showModal(); else kort.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    history.pushState({ kort: true }, "");
    if (reduceret) { kImg.style.opacity = ""; return; }
    travl = true;
    var D = 620;
    anim(kFlade, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
    bagtaeppe(0, 1, { duration: 420, easing: "ease-out" });
    anim(kTop, [{ transform: "translateY(-100%)" }, { transform: "none" }], { duration: 560, delay: 60, easing: BLOED });
    anim(kNav, [{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 560, delay: 60, easing: BLOED });
    anim(kFig, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 120, easing: "ease-out" });
    [kTitel, kTekst].forEach(function (el, k) {
      anim(el, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: 300 + k * 90, easing: BLOED });
    });
    var billedeKlar = klar(kImg);
    if (fri && fra && fra.width) {
      skjul(kilde);
      kImg.style.opacity = "0";
      var til = contain(kFig.getBoundingClientRect(), s.bredde / s.hoejde);
      flyver = nyFlyver(s);
      var midt = { left: (fra.left + til.left) / 2, top: Math.min(fra.top, til.top) - 24, width: (fra.width + til.width) / 2 };
      var fly = anim(flyver, [
        { transform: tilTransform(fra, s.bredde) },
        { transform: tilTransform(midt, s.bredde), offset: .55 },
        { transform: tilTransform(til, s.bredde) }
      ], { duration: D, easing: BLOED });
      Promise.all([faerdig(fly), billedeKlar]).then(function () {
        var f = flyver;
        kImg.style.opacity = "";
        anim(kImg, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease" });
        if (f) faerdig(anim(f, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease" })).then(function () { if (flyver === f) fjernFlyver(); });
        travl = false;
      });
    } else {
      kImg.style.opacity = "";
      anim(kImg, [{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: 140, easing: BLOED });
      vent(D).then(function () { travl = false; });
    }
  }

  // Forrige/Næste: indholdet glider ud til den ene side og det nye ind fra den anden
  function skift(i) {
    if (i < 0 || i >= data.length || travl) return;
    if (reduceret) { udfyld(i); skjul(stationImg(i)); return; }
    travl = true;
    var ret = i > aktiv ? 1 : -1;
    var dele = [kFig, kTitel, kTekst];
    var ud = dele.map(function (el, k) {
      return anim(el, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + (-ret * 44) + "px)" }], { duration: 220, delay: k * 30, easing: "cubic-bezier(.4,0,1,1)" });
    });
    Promise.all(ud.map(faerdig)).then(function () {
      fjernFlyver();
      udfyld(i);
      skjul(erFri(data[i]) ? stationImg(i) : null);
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
    fjernFlyver();
  }

  var lukker = false;
  function luk() {
    if (!erAaben() || lukker) return;
    var s = data[aktiv], el = document.getElementById("station-" + s.nr);
    if (reduceret || !el) { lukDialog(); return; }
    lukker = true; travl = true;
    el.classList.add("er-set");
    el.scrollIntoView({ block: "center", behavior: "instant" });
    var maal = stationImg(aktiv);
    var fri = erFri(s) && maal;
    var D = 560;
    var faser = [];
    if (fri) {
      skjul(maal);
      var fra = contain(kFig.getBoundingClientRect(), s.bredde / s.hoejde);
      var til = contain(maal.getBoundingClientRect(), s.bredde / s.hoejde);
      fjernFlyver();
      flyver = nyFlyver(s);
      var f = flyver;
      anim(kImg, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease" });
      anim(f, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease" });
      faser.push(faerdig(anim(f, [{ transform: tilTransform(fra, s.bredde) }, { transform: tilTransform(til, s.bredde) }], { duration: D, delay: 160, easing: BLOED })));
    } else {
      anim(kFig, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.96)" }], { duration: 300, easing: "ease-in" });
    }
    anim(kTitel, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in" });
    anim(kTekst, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in" });
    anim(kTop, [{ transform: "none" }, { transform: "translateY(-100%)" }], { duration: 380, delay: 80, easing: "cubic-bezier(.5,0,.75,0)" });
    anim(kNav, [{ transform: "none" }, { transform: "translateY(100%)" }], { duration: 380, delay: 80, easing: "cubic-bezier(.5,0,.75,0)" });
    if (fri) anim(kFig, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 200, easing: "ease-in-out" });
    bagtaeppe(1, 0, { duration: 420, delay: 200, easing: "ease-in-out" });
    faser.push(faerdig(anim(kFlade, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 200, easing: "ease-in-out" })));
    Promise.all(faser).then(function () {
      skjul(null);
      lukDialog();
    });
  }

  kort.addEventListener("close", function () {
    document.body.style.overflow = "";
    nulstil();
    skjul(null);
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
