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

  // ---------- Smagsprøve: 5 fritlagte skulpturer ved stiens start ----------
  var proeve = document.getElementById("smagsproeve");
  if (proeve) {
    // [venstre %, bredde %, z-index, rotation]
    var pladser = [[2, 26, 2, -4], [20, 30, 3, 2], [33, 40, 5, 0], [62, 22, 4, -2], [74, 26, 2, 4]];
    var ids = (proeve.dataset.ids || "").split(",");
    var valgt = ids.map(function (id) { return data.filter(function (s) { return s.id === id && erFri(s); })[0]; }).filter(Boolean);
    valgt.forEach(function (s, k) {
      var p = pladser[k] || pladser[0];
      var img = document.createElement("img");
      img.src = s.billede; img.alt = "";
      img.style.left = p[0] + "%"; img.style.width = p[1] + "%"; img.style.zIndex = p[2];
      img.style.maxHeight = "100%"; img.style.objectFit = "contain";
      img.style.setProperty("--rot", p[3] + "deg");
      img.style.transitionDelay = (k * 0.12) + "s";
      img.style.rotate = p[3] + "deg";
      proeve.appendChild(img);
    });
    if (!valgt.length) proeve.remove();
  }

  // Indtoning
  var stationer = liste.querySelectorAll(".station");
  var vis = [].slice.call(stationer);
  if (proeve) vis.push(proeve);
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
  var kNr = document.getElementById("kort-nr");
  var kFig = kort.querySelector(".kort__fig");
  var kImg = document.getElementById("kort-img");
  var kTitel = document.getElementById("kort-titel");
  var kTekst = document.getElementById("kort-tekst");
  var kIndhold = document.getElementById("kort-indhold");
  var forrige = document.getElementById("kort-forrige");
  var naeste = document.getElementById("kort-naeste");
  var aktiv = 0;

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
    if (data[i + 1]) { var pre = new Image(); pre.src = data[i + 1].kort || data[i + 1].original || data[i + 1].billede; }
  }

  function skift(i) {
    if (i < 0 || i >= data.length) return;
    if (reduceret) { udfyld(i); return; }
    kort.classList.add("skifter");
    setTimeout(function () { udfyld(i); kort.classList.remove("skifter"); }, 180);
  }

  // Årringe der breder sig ud fra punktet (x, y)
  function aarringe(x, y) {
    var lag = document.createElement("div");
    lag.className = "ringe";
    var maks = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) / 20;
    for (var k = 0; k < 4; k++) {
      var r = document.createElement("i");
      r.style.left = x + "px"; r.style.top = y + "px";
      lag.appendChild(r);
      r.animate([
        { transform: "scale(.2)", opacity: 0.9 },
        { transform: "scale(" + maks + ")", opacity: 0 }
      ], { duration: 900, delay: k * 110, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" });
    }
    document.body.appendChild(lag);
    setTimeout(function () { lag.remove(); }, 1500);
  }

  // Skulpturen flyver fra stien op i kortet og bliver til fotoet
  function flyv(fraImg) {
    var fra = fraImg.getBoundingClientRect();
    var til = kFig.getBoundingClientRect();
    var fly = document.createElement("img");
    fly.className = "flyver";
    fly.src = fraImg.currentSrc || fraImg.src;
    fly.style.left = fra.left + "px"; fly.style.top = fra.top + "px";
    fly.style.width = fra.width + "px"; fly.style.height = fra.height + "px";
    document.body.appendChild(fly);
    var sk = Math.min(til.width / fra.width, til.height / fra.height) * 0.9;
    var dx = til.left + til.width / 2 - (fra.left + fra.width / 2);
    var dy = til.top + til.height / 2 - (fra.top + fra.height / 2);
    kImg.style.opacity = 0;
    var a = fly.animate([
      { transform: "translate(0,0) scale(1) rotate(0deg)" },
      { transform: "translate(" + dx * 0.55 + "px," + (dy * 0.55 - 40) + "px) scale(" + (1 + (sk - 1) * 0.6) + ") rotate(-3deg)", offset: 0.6 },
      { transform: "translate(" + dx + "px," + dy + "px) scale(" + sk + ") rotate(0deg)" }
    ], { duration: 650, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" });
    a.onfinish = function () {
      var klar = function () {
        kImg.style.opacity = 1;
        fly.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: "forwards" }).onfinish = function () { fly.remove(); };
      };
      if (kImg.complete && kImg.naturalWidth) klar(); else { kImg.onload = klar; setTimeout(klar, 2500); }
    };
  }

  function aabn(i, knap) {
    udfyld(i);
    var img = knap && knap.querySelector("img");
    var r = img ? img.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (typeof kort.showModal === "function") kort.showModal(); else kort.setAttribute("open", "");
    var d = kort.getBoundingClientRect(); cx -= d.left; cy -= d.top;
    document.body.style.overflow = "hidden";
    history.pushState({ kort: true }, "");
    if (reduceret) return;
    kort.animate([
      { clipPath: "circle(0px at " + cx + "px " + cy + "px)" },
      { clipPath: "circle(" + Math.hypot(innerWidth, innerHeight) + "px at " + cx + "px " + cy + "px)" }
    ], { duration: 700, easing: "cubic-bezier(.6,0,.2,1)" });
    aarringe(cx + d.left, cy + d.top);
    if (img) requestAnimationFrame(function () { flyv(img); });
  }

  function erAaben() { return kort.hasAttribute("open"); }
  function lukDialog() {
    if (typeof kort.close === "function") kort.close();
    else { kort.removeAttribute("open"); kort.dispatchEvent(new Event("close")); }
  }
  var lukker = false;
  function luk() {
    if (!erAaben() || lukker) return;
    var el = document.getElementById("station-" + data[aktiv].nr);
    if (reduceret || !el) { lukDialog(); return; }
    lukker = true;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    var r = el.querySelector("img").getBoundingClientRect();
    var d = kort.getBoundingClientRect();
    var cx = r.left + r.width / 2 - d.left, cy = r.top + r.height / 2 - d.top;
    kort.animate([
      { clipPath: "circle(" + Math.hypot(innerWidth, innerHeight) + "px at " + cx + "px " + cy + "px)" },
      { clipPath: "circle(0px at " + cx + "px " + cy + "px)" }
    ], { duration: 520, easing: "cubic-bezier(.6,0,.4,1)", fill: "forwards" }).onfinish = function () { lukker = false; lukDialog(); this.cancel(); };
  }

  kort.addEventListener("close", function () {
    document.body.style.overflow = "";
    if (history.state && history.state.kort) history.back();
    var el = document.getElementById("station-" + data[aktiv].nr);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "instant" });
      var knap = el.querySelector("button"); if (knap) knap.focus({ preventScroll: true });
    }
  });
  kort.addEventListener("cancel", function (e) { e.preventDefault(); luk(); });

  window.addEventListener("popstate", function () { if (erAaben()) luk(); });

  liste.addEventListener("click", function (e) {
    var knap = e.target.closest(".station__knap");
    if (knap) aabn(+knap.dataset.i, knap);
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
