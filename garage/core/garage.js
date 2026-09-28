/* DBI Digital Garage: shared behaviour.
   Load with a plain <script> as the first thing in <body>, so the shutter covers the page from the first paint.
   <html data-media="../media/"> tells it where the media folder is. */
(function () {
  var root = document.documentElement;
  var M = root.getAttribute('data-media') || 'media/';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var skipIntro = reduce || /[?&]nointro\b/.test(location.search) || !document.body.animate;
  var tall = function () { return window.matchMedia && matchMedia('(orientation: portrait)').matches; };
  root.classList.add('js');

  // the host occasionally answers a burst of image requests with a 503: retry each failed image once
  document.addEventListener('error', function (e) {
    var el = e.target;
    if (el.tagName !== 'IMG' || el.dataset.retried) return;
    el.dataset.retried = '1';
    setTimeout(function () { el.src = el.src.split('?')[0] + '?r=1'; }, 900);
  }, true);

  function done() {
    root.classList.remove('gate-lock');
    root.classList.add('opened');
    document.dispatchEvent(new CustomEvent('garage:open'));
  }

  if (skipIntro) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', done); else done();
  } else {
    root.classList.add('gate-lock');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    var lights = document.createElement('div');
    lights.id = 'lights';
    lights.innerHTML = '<video muted playsinline preload="auto"></video><button class="skip" type="button">Skip</button>';
    var gate = document.createElement('div');
    gate.id = 'gate'; gate.setAttribute('role', 'button'); gate.tabIndex = 0; gate.setAttribute('aria-label', 'Open the garage');
    gate.innerHTML =
      '<div class="door"><picture><source media="(orientation: portrait)" srcset="' + M + 'shutter-tall.webp">' +
      '<img src="' + M + 'shutter-wide.webp" alt="DBI Motor Wrapping garage door"></picture><div class="spill"></div></div>' +
      '<div class="drum"></div>' +
      '<div class="hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>Scroll or tap to open<i></i></div>';
    document.body.insertBefore(lights, document.body.firstChild);
    document.body.insertBefore(gate, document.body.firstChild);

    var v = lights.querySelector('video');
    v.src = M + (tall() ? 'lights-tall.mp4' : 'lights-wide.mp4');
    v.load();

    var finished = false;
    function finish() {
      if (finished) return; finished = true;
      done();
      lights.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-out', fill: 'forwards' }).onfinish = function () { lights.remove(); };
    }
    lights.querySelector('.skip').addEventListener('click', function () { if (gate.isConnected) gate.remove(); finish(); });

    function playLights() {
      v.playbackRate = 1.35;
      var p = v.play();
      if (p && p.catch) p.catch(finish);
      v.addEventListener('ended', finish);
      // a slow connection never holds the page: give up on the clip if it hasn't started
      setTimeout(function () { if (v.currentTime < 0.1) finish(); }, 1600);
      setTimeout(finish, 6000);
    }

    var opened = false;
    function open() {
      if (opened) return; opened = true;
      gate.querySelector('.hint').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      var up = gate.querySelector('.door').animate([
        { transform: 'translateY(0)' }, { transform: 'translateY(1.2%)', offset: .12 }, { transform: 'translateY(-101%)' }
      ], { duration: 1400, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'forwards' });
      gate.querySelector('.spill').animate([{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: .8 }], { duration: 1400, fill: 'forwards' });
      gate.querySelector('.drum').animate([{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: 1400, fill: 'forwards' });
      setTimeout(playLights, 350);
      up.onfinish = function () { gate.remove(); };
    }
    addEventListener('wheel', open, { passive: true, once: true });
    addEventListener('touchmove', open, { passive: true, once: true });
    addEventListener('keydown', open, { once: true });
    gate.addEventListener('click', open);

    var AUTO = 2200, img = gate.querySelector('img'), bar = gate.querySelector('.hint i');
    function arm() { bar.animate([{ width: '0%' }, { width: '100%' }], { duration: AUTO, fill: 'forwards' }); setTimeout(open, AUTO); }
    if (img.complete && img.naturalWidth) arm(); else { img.addEventListener('load', arm); img.addEventListener('error', open); setTimeout(open, 5000); }
  }

  /* ---------- page features, once the DOM is ready ---------- */
  function ready() {
    // hero video: desktop or phone cut, started once the garage is open
    document.querySelectorAll('video[data-wide]').forEach(function (hv) {
      hv.src = tall() && hv.dataset.tall ? hv.dataset.tall : hv.dataset.wide;
      if (hv.dataset.posterTall && tall()) hv.poster = hv.dataset.posterTall;
      var go = function () { var p = hv.play(); if (p && p.catch) p.catch(function () {}); };
      if (root.classList.contains('opened')) go(); else document.addEventListener('garage:open', go, { once: true });
    });

    // other videos play only while on screen
    var vio = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { var el = e.target; if (e.isIntersecting) { var p = el.play(); if (p && p.catch) p.catch(function () {}); } else el.pause(); });
    }, { threshold: .25 }) : null;
    document.querySelectorAll('video[data-inview]').forEach(function (el) { if (vio) vio.observe(el); else el.play(); });

    // reveal on scroll
    var rv = document.querySelectorAll('.rv');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      rv.forEach(function (el) { io.observe(el); });
    } else rv.forEach(function (el) { el.classList.add('in'); });

    // cars from every angle
    document.querySelectorAll('[data-angles]').forEach(function (box) {
      var sets = JSON.parse(box.getAttribute('data-angles'));
      var img = box.querySelector('.car img'), label = box.querySelector('[data-angle-label]');
      var car = Object.keys(sets)[0], i = 0;
      function show() {
        var list = sets[car].shots, src = M + list[i];
        img.classList.add('swap');
        var pre = new Image(); pre.onload = pre.onerror = function () { img.src = src; img.alt = sets[car].name; img.classList.remove('swap'); };
        pre.src = src;
        if (label) label.textContent = sets[car].name + ' · ' + (i + 1) + ' / ' + list.length;
        box.querySelectorAll('[data-car]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.car === car); });
      }
      box.querySelectorAll('[data-car]').forEach(function (b) { b.addEventListener('click', function () { car = b.dataset.car; i = 0; show(); }); });
      box.querySelectorAll('[data-step]').forEach(function (b) {
        b.addEventListener('click', function () { var n = sets[car].shots.length; i = (i + (+b.dataset.step) + n) % n; show(); });
      });
      var x0 = null, stage = box.querySelector('.stage');
      stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
      stage.addEventListener('pointerup', function (e) {
        if (x0 === null) return; var dx = e.clientX - x0; x0 = null;
        if (Math.abs(dx) > 40) { var n = sets[car].shots.length; i = (i + (dx < 0 ? 1 : -1) + n) % n; show(); }
      });
      Object.keys(sets).forEach(function (k) { sets[k].shots.forEach(function (s) { new Image().src = M + s; }); });
      show();
    });

    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
