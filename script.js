/* Interactive figures. No dependencies. Everything degrades to static if JS is off. */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hero stack: tilt on pointer, spread on scroll ---------- */
  const stack = document.getElementById('stack');
  if (stack) {
    const layers = [...stack.querySelectorAll('.layer')];
    let tiltX = 0, tiltY = 0, spread = 0, raf = 0;
    const apply = () => {
      raf = 0;
      layers.forEach((el, i) => {
        const z = -i * (60 + spread * 90);
        const y = i * (spread * 26);
        el.style.transform = `translate3d(0, ${y}px, ${z}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    if (!reduce) {
      stack.addEventListener('pointermove', (e) => {
        const r = stack.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        tiltY = px * 14; tiltX = -py * 10; schedule();
      });
      stack.addEventListener('pointerleave', () => { tiltX = 0; tiltY = 0; schedule(); });
      const onScroll = () => {
        const r = stack.getBoundingClientRect();
        const vh = window.innerHeight;
        // 0 when the stack is centred in the viewport, 1 when it has moved a third of the way up
        const t = Math.min(1, Math.max(0, (vh * 0.5 - r.top - r.height * 0.5) / (vh * 0.35)));
        spread = t; schedule();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    } else {
      spread = 1; apply();
    }
  }

  /* ---------- Spondula: play the selected recording when the figure is in view ---------- */
  const fig = document.getElementById('fig-spondula');
  if (fig) {
    new IntersectionObserver((es) => {
      const on = fig.querySelector('video.is-on');
      if (!on) return;
      if (es[0].isIntersecting) { on.play().catch(() => {}); } else { on.pause(); }
    }, { threshold: 0.2 }).observe(fig);
  }

  /* ---------- Spondula: switch recordings ---------- */
  const tabs = document.querySelectorAll('#fig-spondula [role="tab"]');
  const caps = {
    send: 'Sending 10 USD-S to a handle on iOS. Fee free, arrives instantly.',
    chat: 'Paying inside a chat. The payment is a message in the thread.',
    teaser: 'Corridor teaser rendered from data by the Remotion motion kit.'
  };
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.video;
      tabs.forEach((b) => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
      document.querySelectorAll('#fig-spondula video').forEach((v) => {
        const on = v.id === 'v-' + id;
        v.classList.toggle('is-on', on);
        if (on) { v.play().catch(() => {}); } else { v.pause(); }
      });
      document.getElementById('cap-spondula').textContent = caps[id];
    });
  });

  /* ---------- Crimson Desert: quantised surface ---------- */
  const qc = document.getElementById('quant');
  if (qc) {
    const ctx = qc.getContext('2d');
    const bitsEl = document.getElementById('bits');
    const bitsOut = document.getElementById('bits-out');
    const bboxEl = document.getElementById('bbox');
    // A synthetic winged surface: a parametric sheet folded like a wing membrane.
    const U = 34, V = 18, pts = [];
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
      const u = i / (U - 1), v = j / (V - 1);
      const x = (u - 0.5) * 2.2;
      const y = (v - 0.5) * 1.1 + Math.sin(u * Math.PI) * 0.35 * (v - 0.5);
      const z = Math.sin(u * Math.PI * 2) * 0.28 * Math.cos(v * Math.PI) + Math.cos(u * Math.PI * 3) * 0.12;
      pts.push([x, y, z]);
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    pts.forEach((p) => p.forEach((c, k) => { min[k] = Math.min(min[k], c); max[k] = Math.max(max[k], c); }));
    const dim = max.map((m, k) => m - min[k]);
    let angle = 0, bits = 16, showBox = true, visible = false;
    const quant = (p) => p.map((c, k) => {
      const steps = Math.pow(2, bits) - 1;
      const u = Math.round(((c - min[k]) / dim[k]) * steps);
      return min[k] + (u / steps) * dim[k];
    });
    const project = (p, w, h) => {
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const x = p[0] * ca - p[2] * sa, z = p[0] * sa + p[2] * ca, y = p[1];
      const tilt = 0.55, yy = y * Math.cos(tilt) - z * Math.sin(tilt), zz = y * Math.sin(tilt) + z * Math.cos(tilt);
      const f = 2.6 / (2.6 + zz);
      return [w / 2 + x * f * w * 0.33, h / 2 + yy * f * h * 0.42, f];
    };
    const draw = () => {
      const w = qc.width, h = qc.height;
      ctx.clearRect(0, 0, w, h);
      const proj = pts.map((p) => project(quant(p), w, h));
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
        const a = proj[i * V + j];
        if (i + 1 < U) { const b = proj[(i + 1) * V + j]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        if (j + 1 < V) { const b = proj[i * V + j + 1]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      }
      ctx.stroke();
      ctx.fillStyle = '#1D4ED8';
      proj.forEach((p) => { ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * p[2], 0, Math.PI * 2); ctx.fill(); });
      if (showBox) {
        const c = [];
        for (let k = 0; k < 8; k++) c.push(project([k & 1 ? max[0] : min[0], k & 2 ? max[1] : min[1], k & 4 ? max[2] : min[2]], w, h));
        ctx.strokeStyle = 'rgba(29,78,216,0.8)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a, b]) => { ctx.moveTo(c[a][0], c[a][1]); ctx.lineTo(c[b][0], c[b][1]); });
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#000';
      ctx.font = '600 14px Archivo, Helvetica, Arial, sans-serif';
      ctx.fillText(`${bits} bits per axis, ${Math.pow(2, bits).toLocaleString('en-GB')} steps across the box`, 16, h - 18);
    };
    const tick = () => { if (visible && !reduce) { angle += 0.006; draw(); } requestAnimationFrame(tick); };
    bitsEl.addEventListener('input', () => { bits = +bitsEl.value; bitsOut.textContent = bits + ' bits'; draw(); });
    bboxEl.addEventListener('change', () => { showBox = bboxEl.checked; draw(); });
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0.1 }).observe(qc);
    draw(); requestAnimationFrame(tick);
  }

  /* ---------- vault-brain: walk, reconcile, link on the fixture vault ---------- */
  const gc = document.getElementById('graph');
  if (gc) {
    const ctx = gc.getContext('2d');
    const W = gc.width, H = gc.height;
    // Fixture vault from the toolkit's tests. Entities and the episodes that mention them.
    const nodes = [
      { id: 'Orchard release', x: 0.30, y: 0.34, kind: 'entity' },
      { id: 'Orchard release plan', x: 0.58, y: 0.22, kind: 'entity', mergeInto: 'Orchard release' },
      { id: 'Orchard launch', x: 0.52, y: 0.50, kind: 'entity', mergeInto: 'Orchard release' },
      { id: 'Harbour dashboard', x: 0.74, y: 0.62, kind: 'entity' },
      { id: 'Mina Reyes', x: 0.22, y: 0.70, kind: 'person' },
      { id: 'Shipping cadence', x: 0.62, y: 0.86, kind: 'insight', stage: 2 }
    ];
    const atoms = [
      { to: 'Orchard release', text: 'decision: ship 12 Jan' }, { to: 'Orchard release plan', text: 'fact: two reviewers' },
      { to: 'Orchard launch', text: 'risk: docs late' }, { to: 'Harbour dashboard', text: 'fact: reads Orchard events' },
      { to: 'Mina Reyes', text: 'person: owns Harbour' }, { to: 'Orchard release', text: 'open_question: freeze date' }
    ];
    const edges = [
      { a: 'Harbour dashboard', b: 'Orchard release', t: 'depends-on' },
      { a: 'Mina Reyes', b: 'Harbour dashboard', t: 'about' },
      { a: 'Shipping cadence', b: 'Orchard release', t: 'follows-from' },
      { a: 'Shipping cadence', b: 'Harbour dashboard', t: 'follows-from' }
    ];
    const captions = [
      'Walk: session captures become typed atoms on entity notes.',
      'Reconcile: three notes about one release merge into the canonical one. Links repoint, nothing is deleted.',
      'Link: typed edges between notes, then a well-connected cluster becomes an insight hub.'
    ];
    let stage = 0, t0 = performance.now(), visible = false, auto = true;
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    const draw = (now) => {
      const p = Math.min(1, (now - t0) / 900), e = ease(p);
      ctx.clearRect(0, 0, W, H);
      ctx.font = '600 13px Archivo, Helvetica, Arial, sans-serif';
      // atoms fly in during walk
      atoms.forEach((a, i) => {
        const n = byId[a.to];
        const target = (stage >= 1 && n.mergeInto) ? byId[n.mergeInto] : n;
        const k = stage === 0 ? Math.min(1, Math.max(0, (p * 6 - i) )) : 1;
        const ax = W * (0.5 + (i % 3 - 1) * 0.25), ay = H * 0.05;
        const x = ax + (target.x * W - ax) * ease(k), y = ay + (target.y * H + 34 + (i % 2) * 14 - ay) * ease(k);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillText(a.text, x + 10, y);
        ctx.fillStyle = '#1D4ED8';
        ctx.beginPath(); ctx.arc(x, y - 4, 3, 0, Math.PI * 2); ctx.fill();
      });
      // edges appear during link
      if (stage >= 2) {
        ctx.strokeStyle = 'rgba(29,78,216,0.9)'; ctx.lineWidth = 1.5;
        edges.forEach((ed, i) => {
          const a = byId[ed.a], b = byId[ed.b];
          const k = Math.min(1, Math.max(0, p * 4 - i * 0.6));
          if (k <= 0) return;
          ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H);
          ctx.lineTo(a.x * W + (b.x * W - a.x * W) * k, a.y * H + (b.y * H - a.y * H) * k); ctx.stroke();
          if (k === 1) { ctx.fillStyle = '#1D4ED8'; ctx.fillText(ed.t, (a.x + b.x) / 2 * W + 6, (a.y + b.y) / 2 * H - 6); }
        });
      }
      // nodes
      nodes.forEach((n) => {
        if (n.stage === 2 && stage < 2) return;
        let x = n.x * W, y = n.y * H, alpha = 1, r = n.kind === 'insight' ? 16 : 12;
        if (stage >= 1 && n.mergeInto) {
          const m = byId[n.mergeInto];
          x += (m.x * W - x) * e; y += (m.y * H - y) * e; alpha = 1 - e;
        }
        if (n.stage === 2) alpha = e;
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.kind === 'insight' ? '#1D4ED8' : n.kind === 'person' ? '#fff' : '#000';
        ctx.fill();
        if (n.kind === 'person') { ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fillStyle = '#000';
        ctx.font = '700 15px Archivo, Helvetica, Arial, sans-serif';
        ctx.fillText(n.id, x + r + 8, y + 5);
        ctx.globalAlpha = 1;
      });
      if (stage >= 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = '600 13px Archivo, Helvetica, Arial, sans-serif';
        ctx.fillText('archived: Orchard release plan, Orchard launch  (status: superseded)', 16, H - 18);
      }
    };
    const setStage = (s, fromUser) => {
      stage = s; t0 = performance.now();
      if (fromUser) auto = false;
      document.querySelectorAll('#fig-graph [data-stage]').forEach((b) => b.classList.toggle('is-on', +b.dataset.stage === s));
      document.getElementById('cap-graph').textContent = captions[s];
    };
    document.querySelectorAll('#fig-graph [data-stage]').forEach((b) => b.addEventListener('click', () => setStage(+b.dataset.stage, true)));
    let last = 0;
    const tick = (now) => {
      if (visible) {
        draw(now);
        if (auto && !reduce && now - t0 > 3200) setStage((stage + 1) % 3, false);
      }
      requestAnimationFrame(tick);
    };
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) t0 = performance.now(); }, { threshold: 0.2 }).observe(gc);
    requestAnimationFrame(tick);
  }

  /* ---------- The Digital Sandbox: load the live site on request ---------- */
  const loadBtn = document.getElementById('load-tds');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      const f = document.getElementById('tds-frame');
      f.src = 'https://thedigitalsandbox.co.uk/';
      f.classList.add('is-on');
      loadBtn.remove();
    });
  }
})();
