(() => {
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#8b5cf6', '#22d3ee', '#ff4da6', '#3b8bff'];

  // Headings: split into letters that swell like bubbles under the pointer
  $$('.letters').forEach(el => {
    const text = el.textContent;
    el.textContent = '';
    if (el.tagName === 'H2') el.setAttribute('aria-label', text);
    let i = 0;
    text.split(' ').forEach((word, w) => {
      if (w) el.append(' ');
      const box = document.createElement('span');
      box.className = 'word';
      box.setAttribute('aria-hidden', 'true');
      [...word].forEach(ch => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        s.style.setProperty('--i', i++);
        s.addEventListener('pointerenter', () => restart(s, 'boing'));
        box.append(s);
      });
      el.append(box);
    });
  });

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }

  // Bubble particles on a single canvas
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let bubbles = [], running = false;

  function resize() {
    const r = devicePixelRatio || 1;
    canvas.width = innerWidth * r;
    canvas.height = innerHeight * r;
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  resize();
  addEventListener('resize', resize);

  function emit(x, y, count, burst) {
    if (calm) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = burst ? 2 + Math.random() * 5 : Math.random() * .6;
      bubbles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: burst ? Math.sin(a) * v : -.5 - Math.random(),
        r: 3 + Math.random() * (burst ? 10 : 8),
        life: 1,
        c: COLORS[Math.random() * COLORS.length | 0]
      });
    }
    if (bubbles.length > 220) bubbles = bubbles.slice(-220);
    if (!running) { running = true; requestAnimationFrame(draw); }
  }

  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bubbles = bubbles.filter(b => (b.life -= .018) > 0);
    for (const b of bubbles) {
      b.x += b.vx; b.y += b.vy;
      b.vx *= .94; b.vy = b.vy * .94 - .05;
      ctx.globalAlpha = b.life;
      ctx.strokeStyle = b.c;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke();
      ctx.fillStyle = b.c;
      ctx.globalAlpha = b.life * .14; ctx.fill();
      ctx.globalAlpha = b.life * .9; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(b.x - b.r * .35, b.y - b.r * .35, b.r * .22, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (bubbles.length) requestAnimationFrame(draw); else running = false;
  }

  // Pointer trail
  let last = 0;
  addEventListener('pointermove', e => {
    if (e.timeStamp - last < 45) return;
    last = e.timeStamp;
    emit(e.clientX, e.clientY, 1, false);
  }, { passive: true });

  // Hover: content wobbles, releases bubbles, and light follows the pointer
  $$('.card, .chip, .btn, .tags li, p, .brand, time').forEach(el => {
    el.addEventListener('pointerenter', e => {
      if (e.pointerType === 'touch') return;
      emit(e.clientX, e.clientY, 5, false);
      if (!calm && !el.classList.contains('reveal')) restart(el, 'jelly');
      else if (!calm && el.classList.contains('in')) restart(el, 'jelly');
    });
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - r.left + 'px');
      el.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  });

  // Buttons lean toward the pointer
  if (!calm) $$('.magnet').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.translate = `${(e.clientX - r.left - r.width / 2) * .18}px ${(e.clientY - r.top - r.height / 2) * .3}px`;
    });
    el.addEventListener('pointerleave', () => el.style.translate = '');
  });

  // Click: burst of bubbles plus a squash on the clicked item
  addEventListener('click', e => {
    const target = e.target.closest('.pop, .orb, .card, .nav a');
    let { clientX: x, clientY: y } = e;
    if (e.detail === 0 && target) {            // keyboard activation
      const r = target.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    emit(x, y, target ? 24 : 10, true);
    if (!target || calm) return;
    restart(target, target.classList.contains('orb') ? 'popped' : 'squash');
  });

  window.fx = { $$, calm, emit };
})();

(() => {
  const { $$, calm, emit } = window.fx;
  const root = document.documentElement;
  const bar = document.querySelector('.progress');
  const top = document.querySelector('.to-top');
  const links = $$('.nav nav a');
  const sections = $$('main section');

  // Scrolling down: items rise from below. Scrolling up: items drop from above.
  // They reset once off screen, so the animation replays every time.
  let lastY = scrollY;
  const items = $$('.reveal');
  const delay = el => {
    const peers = $$(':scope > .reveal', el.parentElement);
    return Math.max(peers.indexOf(el), 0) * 110;
  };
  items.forEach(el => el.style.setProperty('--delay', delay(el) + 'ms'));

  const io = new IntersectionObserver(entries => entries.forEach(({ target, isIntersecting, boundingClientRect }) => {
    if (isIntersecting) {
      target.classList.add('in');
    } else {
      target.classList.remove('in', 'jelly', 'squash');
      target.classList.toggle('from-top', boundingClientRect.top < 0);
    }
  }), { threshold: 0, rootMargin: '0px 0px -6% 0px' });
  if (!calm) items.forEach(el => io.observe(el));
  else items.forEach(el => el.classList.add('in'));

  function onScroll() {
    const y = scrollY;
    const max = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max ? y / max : 0})`;
    top.classList.toggle('show', y > 500);
    if (y !== lastY) root.dataset.dir = y > lastY ? 'down' : 'up';
    lastY = y;
    for (const el of items) {              // keep the entry side right after long jumps
      if (el.classList.contains('in')) continue;
      const r = el.getBoundingClientRect();
      if (r.top > innerHeight) el.classList.remove('from-top');
      else if (r.bottom < 0) el.classList.add('from-top');
    }
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * .4) current = s;
    if (max - y < 4) current = sections[sections.length - 1];
    links.forEach(a => a.classList.toggle('active', a.hash === '#' + current.id));
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Back to top, with bubbles streaming from the button
  top.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
    const r = top.getBoundingClientRect();
    let n = 0;
    const t = setInterval(() => {
      emit(r.left + r.width / 2, r.top, 4, false);
      if (++n > 12) clearInterval(t);
    }, 60);
  });
})();

document.querySelectorAll('h1 .ch').forEach(c =>
  c.addEventListener('animationend', () => c.style.animation = 'none'));