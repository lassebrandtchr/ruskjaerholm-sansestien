(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var data = window.STATIONER || [];
  var liste = document.getElementById("stationer");
  var reduceret = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Stationer ----------
  data.forEach(function (s, i) {
    var li = document.createElement("li");
    li.className = "station" + (s.visning === "fritlagt-klar" ? " station--fri" : "");
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

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  // Indtoning
  var stationer = liste.querySelectorAll(".station");
  if ("IntersectionObserver" in window && !reduceret) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add("er-set"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px" });
    stationer.forEach(function (el) { io.observe(el); });
  } else {
    stationer.forEach(function (el) { el.classList.add("er-set"); });
  }

  // ---------- Stien (SVG der tegnes mens man scroller) ----------
  var bane = document.querySelector(".sti__bane");
  var svg = document.querySelector(".sti__svg");
  var grus = svg.querySelector(".sti__grus");
  var spor = svg.querySelector(".sti__spor");
  var gaaer = svg.querySelector(".sti__gaaer");
  var laengde = 0;

  function tegnSti() {
    var b = bane.getBoundingClientRect();
    var w = b.width, h = b.height;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    var pts = [[w / 2, 24]];
    stationer.forEach(function (el, i) {
      var r = el.getBoundingClientRect();
      var y = r.top - b.top + r.height / 2;
      // Stien slynger sig på den modsatte side af billedet
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
  window.addEventListener("resize", tegnSti);
  window.addEventListener("load", tegnSti);
  if ("ResizeObserver" in window) new ResizeObserver(tegnSti).observe(liste);
  tegnSti();

  // ---------- Stationskort ----------
  var kort = document.getElementById("kort");
  var kNr = document.getElementById("kort-nr");
  var kImg = document.getElementById("kort-img");
  var kTitel = document.getElementById("kort-titel");
  var kTekst = document.getElementById("kort-tekst");
  var kIndhold = document.getElementById("kort-indhold");
  var forrige = document.getElementById("kort-forrige");
  var naeste = document.getElementById("kort-naeste");
  var aktiv = 0;

  function vis(i) {
    aktiv = i;
    var s = data[i];
    kNr.textContent = "Station " + s.nr + " af " + data.length;
    kImg.src = s.original || s.billede;
    kImg.alt = s.titel;
    kTitel.textContent = s.titel + (s.emoji ? " " + s.emoji : "");
    var tekst = s.tekst.replace(/[“”"]/g, "").trim();
    var titel = s.titel.replace(/[“”"]/g, "").trim();
    kTekst.textContent = tekst.toLowerCase() === titel.toLowerCase() ? "" : s.tekst;
    kTekst.hidden = !kTekst.textContent;
    forrige.disabled = i === 0;
    naeste.disabled = i === data.length - 1;
    kIndhold.scrollTop = 0;
    // Forhåndsindlæs næste billede
    if (data[i + 1]) { var pre = new Image(); pre.src = data[i + 1].original || data[i + 1].billede; }
  }

  function skift(i) {
    if (i < 0 || i >= data.length) return;
    if (reduceret) { vis(i); return; }
    kort.classList.add("skifter");
    setTimeout(function () { vis(i); kort.classList.remove("skifter"); }, 180);
  }

  function aabn(i) {
    vis(i);
    if (typeof kort.showModal === "function") kort.showModal(); else kort.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    history.pushState({ kort: true }, "");
  }

  function luk(fraHistorik) {
    if (!kort.open) return;
    kort.close ? kort.close() : kort.removeAttribute("open");
  }

  kort.addEventListener("close", function () {
    document.body.style.overflow = "";
    if (history.state && history.state.kort) history.back();
    var el = document.getElementById("station-" + data[aktiv].nr);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: reduceret ? "auto" : "smooth" });
      var knap = el.querySelector("button"); if (knap) knap.focus({ preventScroll: true });
    }
  });

  // Telefonens tilbage-knap lukker kortet i stedet for at forlade siden
  window.addEventListener("popstate", function () { if (kort.open) kort.close(); });

  liste.addEventListener("click", function (e) {
    var knap = e.target.closest(".station__knap");
    if (knap) aabn(+knap.dataset.i);
  });
  document.getElementById("kort-luk").addEventListener("click", function () { luk(); });
  forrige.addEventListener("click", function () { skift(aktiv - 1); });
  naeste.addEventListener("click", function () { skift(aktiv + 1); });
  kort.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") skift(aktiv + 1);
    if (e.key === "ArrowLeft") skift(aktiv - 1);
  });

  // Swipe til siden
  var sx = 0, sy = 0;
  kIndhold.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  kIndhold.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) skift(aktiv + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();
