// Ferro Coffee Co. — scroll-driven canvas frame playback + section choreography
(function () {
  var TOTAL_FRAMES = 270;
  var FRAME_PATH = function (i) { return 'frames/frame_' + String(i).padStart(4, '0') + '.webp'; };
  var IMAGE_SCALE = 0.85;
  var FRAME_SPEED = 1.0; // frame playback spans the full scroll range

  var frames = [];
  var framesLoaded = 0;
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var bgColor = '#F0E4D3';
  var lastSampledFrame = -1;

  // ---------- Footer year ----------
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- Mobile nav toggle ----------
  var navToggle = document.getElementById('navToggle');
  var mobileNav = document.getElementById('mobileNav');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { mobileNav.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', 'false'); });
    });
  }

  // ---------- Canvas sizing ----------
  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ---------- Frame preloader ----------
  function loadImage(i) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { framesLoaded++; updateLoaderProgress(); resolve(img); };
      img.onerror = function () { framesLoaded++; updateLoaderProgress(); resolve(img); };
      img.src = FRAME_PATH(i);
      frames[i - 1] = img;
    });
  }

  var loaderBarFill = document.getElementById('loader-bar-fill');
  var loaderPercent = document.getElementById('loader-percent');
  var loaderEl = document.getElementById('loader');

  function updateLoaderProgress() {
    var pct = Math.round((framesLoaded / TOTAL_FRAMES) * 100);
    if (loaderBarFill) loaderBarFill.style.width = pct + '%';
    if (loaderPercent) loaderPercent.textContent = pct + '%';
  }

  function hideLoader() {
    if (loaderEl) loaderEl.classList.add('is-hidden');
  }

  async function preloadFrames() {
    // First 10 frames immediately for fast first paint
    var firstBatch = [];
    for (var i = 1; i <= Math.min(10, TOTAL_FRAMES); i++) firstBatch.push(loadImage(i));
    await Promise.all(firstBatch);
    drawFrame(1);
    hideLoader();

    // Remaining frames in the background
    var rest = [];
    for (var j = 11; j <= TOTAL_FRAMES; j++) rest.push(loadImage(j));
    await Promise.all(rest);
  }

  // ---------- Canvas renderer: padded cover mode ----------
  function sampleEdgeColor(img) {
    try {
      var probe = document.createElement('canvas');
      probe.width = 1; probe.height = 1;
      var pctx = probe.getContext('2d');
      pctx.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
      var d = pctx.getImageData(0, 0, 1, 1).data;
      bgColor = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
    } catch (e) { /* canvas tainted or not ready — keep previous bgColor */ }
  }

  function drawFrame(index) {
    var img = frames[index - 1];
    if (!img || !img.complete || !img.naturalWidth) return;

    if (index - lastSampledFrame >= 20 || lastSampledFrame === -1) {
      sampleEdgeColor(img);
      lastSampledFrame = index;
    }

    var w = window.innerWidth, h = window.innerHeight;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Padded cover: crop the source to the target box's aspect ratio (via a
    // source rect) so the drawn image is exactly IMAGE_SCALE of the viewport
    // in both dimensions — a naive "match one dimension, let the other
    // overflow" approach lets a wider-than-viewport source (this 16:9 clip
    // vs a ~16:10 viewport) blow past the intended padding almost entirely.
    var targetW = w * IMAGE_SCALE, targetH = h * IMAGE_SCALE;
    var imgW = img.naturalWidth, imgH = img.naturalHeight;
    var imgRatio = imgW / imgH, boxRatio = targetW / targetH;
    var sx, sy, sw, sh;
    if (imgRatio > boxRatio) { sh = imgH; sw = imgH * boxRatio; sx = (imgW - sw) / 2; sy = 0; }
    else { sw = imgW; sh = imgW / boxRatio; sx = 0; sy = (imgH - sh) / 2; }
    var dx = (w - targetW) / 2, dy = (h - targetH) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, targetW, targetH);
  }

  var currentFrame = 1;
  function updateCanvasFrame(progress) {
    var mapped = Math.min(1, progress * FRAME_SPEED);
    var idx = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(mapped * (TOTAL_FRAMES - 1)) + 1));
    if (idx !== currentFrame) {
      currentFrame = idx;
    }
    drawFrame(currentFrame);
  }

  // ---------- Lenis smooth scroll ----------
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lenis = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new Lenis({ duration: 1.2, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  gsap.registerPlugin(ScrollTrigger);

  // ---------- Main driver: canvas frame + dark overlay, keyed to #scroll-container progress ----------
  var container = document.getElementById('scroll-container');
  var darkOverlay = document.getElementById('dark-overlay');

  ScrollTrigger.create({
    trigger: container,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: function (self) {
      updateCanvasFrame(self.progress);
    }
  });

  // Dark overlay: 0 -> ~0.9 around the stats section's enter/leave range
  var statsSection = document.querySelector('.section-stats');
  if (statsSection && darkOverlay) {
    var enter = parseFloat(statsSection.dataset.enter);
    var leave = parseFloat(statsSection.dataset.leave);
    ScrollTrigger.create({
      trigger: container, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: function (self) {
        var p = self.progress * 100;
        var fadeIn = enter - 4, fadeOut = leave + 4;
        var op = 0;
        if (p > fadeIn && p < enter) op = (p - fadeIn) / (enter - fadeIn);
        else if (p >= enter && p <= leave) op = 1;
        else if (p > leave && p < fadeOut) op = 1 - (p - leave) / (fadeOut - leave);
        darkOverlay.style.opacity = Math.max(0, Math.min(1, op)) * 0.9;
      }
    });
  }

  // ---------- Section positioning + entrance animation system ----------
  var ANIMATION_FROM = {
    'fade-up': { y: 50, opacity: 0 },
    'slide-left': { x: -80, opacity: 0 },
    'slide-right': { x: 80, opacity: 0 },
    'scale-up': { scale: 0.85, opacity: 0 },
    'rotate-in': { y: 40, rotation: 3, opacity: 0 },
    'stagger-up': { y: 60, opacity: 0 },
    'clip-reveal': { clipPath: 'inset(100% 0 0 0)', opacity: 1 }
  };
  var ANIMATION_DURATION = { 'clip-reveal': 1.2, 'scale-up': 1.0 };

  // Absolute scrollY for a given 0-1 progress through the container, matching
  // the same progress space as the 'top top' -> 'bottom bottom' driver above
  // (progress 0 = container top at viewport top, progress 1 = container
  // bottom at viewport bottom). Passing plain numbers to start/end removes
  // any ambiguity in ScrollTrigger's "top top+=N" shorthand semantics.
  function scrollYForProgress(p) {
    return container.offsetTop + (container.offsetHeight - window.innerHeight) * p;
  }

  document.querySelectorAll('.scroll-section').forEach(function (section) {
    var enter = parseFloat(section.dataset.enter);
    var leave = parseFloat(section.dataset.leave);
    var animType = section.dataset.animation || 'fade-up';
    var persist = section.dataset.persist === 'true';
    var mid = (enter + leave) / 2;

    function positionSection() {
      section.style.top = mid + '%';
      section.style.transform = 'translateY(-50%)';
    }
    positionSection();
    window.addEventListener('resize', positionSection);

    var inner = section.querySelector('.section-inner') || section.querySelector('.stats-grid') || section;
    var isStagger = animType === 'stagger-up' && inner.children.length > 1;
    var targets = isStagger ? gsap.utils.toArray(inner.children) : [inner];
    var fromVars = ANIMATION_FROM[animType] || ANIMATION_FROM['fade-up'];
    gsap.set(targets, fromVars);

    var played = false;
    ScrollTrigger.create({
      trigger: container,
      start: function () { return scrollYForProgress(enter / 100); },
      end: function () { return scrollYForProgress(leave / 100); },
      onEnter: function () {
        section.classList.add('is-active');
        playEntrance();
      },
      onEnterBack: function () {
        section.classList.add('is-active');
        if (!persist) playEntrance();
      },
      onLeave: function () {
        if (!persist) {
          section.classList.remove('is-active');
          gsap.set(targets, fromVars);
          played = false;
        }
      },
      onLeaveBack: function () {
        if (!persist) {
          section.classList.remove('is-active');
          gsap.set(targets, fromVars);
          played = false;
        }
      }
    });

    function playEntrance() {
      if (persist && played) return;
      played = true;
      gsap.to(targets, {
        x: 0, y: 0, opacity: 1, scale: 1, rotation: 0, clipPath: 'inset(0% 0 0 0)',
        duration: ANIMATION_DURATION[animType] || 0.9,
        ease: animType === 'scale-up' ? 'power2.out' : (animType === 'clip-reveal' ? 'power4.inOut' : 'power3.out'),
        stagger: isStagger ? 0.12 : 0
      });
    }
  });

  // ---------- Word-split hero heading (already marked up in spans) ----------
  // Hero is a plain 100vh block in normal document flow (not fixed), so it
  // scrolls away naturally and the fixed canvas underneath is simply there
  // once it's gone — no added wipe/fade effect on top of that.
  gsap.set('.hero-heading .word', { y: 0, opacity: 1 });

  // ---------- Mobile nav / misc ----------
  // (no hamburger needed — nav-links hidden on mobile per design; header CTA remains reachable)

  // ---------- Boot ----------
  preloadFrames().then(function () {
    window.__pageReady = true;
    ScrollTrigger.refresh();
  });
})();
