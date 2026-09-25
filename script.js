/* Interactive figures. No dependencies. Everything degrades to a static frame if JS is off. */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Review helper: ?goto=<id> scrolls that section to the top on load.
  const goto = new URLSearchParams(location.search).get('goto');
  if (goto) window.addEventListener('load', () => { const el = document.getElementById(goto); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8); });
  const INK = '#000', BLUE = '#1D4ED8', MUTED = 'rgba(0,0,0,0.55)';
  const F = (w, size) => `${w} ${size}px Archivo, Helvetica, Arial, sans-serif`;
  const MONO = (size) => `${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const onView = (el, cb, threshold = 0.15) => new IntersectionObserver((es) => cb(es[0].isIntersecting), { threshold }).observe(el);

  /* Shared synthetic surface: a folded sheet, like a wing membrane. */
  const makeSurface = (U, V) => {
    const pts = [];
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
      const u = i / (U - 1), v = j / (V - 1);
      const x = (u - 0.5) * 2.2;
      const y = (v - 0.5) * 1.1 + Math.sin(u * Math.PI) * 0.35 * (v - 0.5);
      const z = Math.sin(u * Math.PI * 2) * 0.28 * Math.cos(v * Math.PI) + Math.cos(u * Math.PI * 3) * 0.12;
      pts.push([x, y, z]);
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    pts.forEach((p) => p.forEach((c, k) => { min[k] = Math.min(min[k], c); max[k] = Math.max(max[k], c); }));
    return { pts, min, max, dim: max.map((m, k) => m - min[k]), U, V };
  };
  const rotate = (p, ay, ax) => {
    const ca = Math.cos(ay), sa = Math.sin(ay);
    const x = p[0] * ca - p[2] * sa, z = p[0] * sa + p[2] * ca, y = p[1];
    return [x, y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  };
  const project = (p, w, h, scale, cx, cy) => {
    const f = 2.8 / (2.8 + p[2]);
    return [cx + p[0] * f * scale, cy + p[1] * f * scale, f];
  };

  /* ---------- Hero: the same mesh at three depths ---------- */
  const dc = document.getElementById('depth');
  if (dc) {
    const ctx = dc.getContext('2d');
    const W = dc.width, H = dc.height;
    const S = makeSurface(30, 16);
    const forced = new URLSearchParams(location.search).get('spread');
    let ay = 0.6, ax = 0.45, dragging = false, lastX = 0, lastY = 0, spread = forced ? +forced : 0, visible = true, frame = 0;
    const hex = [];
    for (let i = 0; i < 64; i++) hex.push(Math.floor(Math.random() * 65536).toString(16).padStart(4, '0'));
    const edgesOf = (proj, stroke, width) => {
      ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.beginPath();
      for (let i = 0; i < S.U; i++) for (let j = 0; j < S.V; j++) {
        const a = proj[i * S.V + j];
        if (i + 1 < S.U) { const b = proj[(i + 1) * S.V + j]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        if (j + 1 < S.V) { const b = proj[i * S.V + j + 1]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      }
      ctx.stroke();
    };
    const boxOf = (scale, cx, cy) => {
      const c = [];
      for (let k = 0; k < 8; k++) c.push(project(rotate([k & 1 ? S.max[0] : S.min[0], k & 2 ? S.max[1] : S.min[1], k & 4 ? S.max[2] : S.min[2]], ay, ax), W, H, scale, cx, cy));
      ctx.strokeStyle = 'rgba(29,78,216,0.9)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath();
      [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a, b]) => { ctx.moveTo(c[a][0], c[a][1]); ctx.lineTo(c[b][0], c[b][1]); });
      ctx.stroke(); ctx.setLineDash([]);
    };
    const label = (text, y, strong) => { ctx.fillStyle = strong ? INK : MUTED; ctx.font = F(strong ? 800 : 600, strong ? 15 : 12); ctx.fillText(text, 18, y); };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const s = ease(spread);
      // At rest: one mesh, large. Opened: three copies stacked, each flattened a little.
      const scale = W * (0.32 - 0.19 * s);
      const cx = W * (0.5 + 0.16 * s);
      const rows = [H * 0.5 - H * 0.35 * s, H * 0.5, H * 0.5 + H * 0.35 * s];
      const P = (cy) => S.pts.map((p) => project(rotate(p, ay, ax + 0.5 * s), W, H, scale, cx, cy));
      // bottom row: bytes
      if (s > 0.02) {
        ctx.globalAlpha = s;
        (() => { const keep = ax; ax = ax + 0.5 * s; boxOf(scale, cx, rows[2]); ax = keep; })();
        ctx.fillStyle = MUTED; ctx.font = MONO(11);
        const off = Math.floor(frame / 8) % hex.length;
        let line = '';
        for (let i = 0; i < 9; i++) line += hex[(off + i) % hex.length] + ' ';
        ctx.fillText(line, cx - scale * 1.1, rows[2] + scale * 0.62);
        label('What the file holds', rows[2] - 6, true);
        label('six bytes per vertex and one box per submesh', rows[2] + 14, false);
        ctx.globalAlpha = 1;
      }
      // middle row: the grid the shader rebuilds (always drawn)
      const mid = P(rows[1]);
      edgesOf(mid, 'rgba(0,0,0,0.6)', 1);
      ctx.fillStyle = BLUE; mid.forEach((p) => { ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * p[2], 0, Math.PI * 2); ctx.fill(); });
      if (s <= 0.02) boxOf(scale, cx, rows[1]);
      if (s > 0.02) { ctx.globalAlpha = s; label('What the shader rebuilds', rows[1] - 6, true); label('pos = bbox_min + (u / 32767) * bbox_dim', rows[1] + 14, false); ctx.globalAlpha = 1; }
      // top row: the shaded surface people see
      if (s > 0.02) {
        ctx.globalAlpha = s;
        const top = P(rows[0]);
        for (let i = 0; i + 1 < S.U; i++) for (let j = 0; j + 1 < S.V; j++) {
          const a = top[i * S.V + j], b = top[(i + 1) * S.V + j], c2 = top[(i + 1) * S.V + j + 1], d = top[i * S.V + j + 1];
          const shade = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(i * 0.45 + ay * 2)) * (0.6 + 0.4 * j / S.V);
          const g = Math.round(40 + 180 * shade);
          ctx.fillStyle = `rgb(${g},${g + 6},${g + 18})`;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
        }
        label('What people see', rows[0] - 6, true);
        label('a rendered surface', rows[0] + 14, false);
        ctx.globalAlpha = 1;
      }
      if (s <= 0.02) { ctx.fillStyle = MUTED; ctx.font = F(600, 12); ctx.fillText('drag to turn, scroll to take apart', 18, H - 16); }
    };
    const tick = () => { if (visible) { if (!dragging && !reduce) ay += 0.004; frame++; draw(); } requestAnimationFrame(tick); };
    dc.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; dc.setPointerCapture(e.pointerId); });
    dc.addEventListener('pointermove', (e) => { if (!dragging) return; ay += (e.clientX - lastX) * 0.008; ax = Math.max(-1.2, Math.min(1.2, ax + (e.clientY - lastY) * 0.006)); lastX = e.clientX; lastY = e.clientY; });
    dc.addEventListener('pointerup', () => { dragging = false; });
    dc.addEventListener('pointercancel', () => { dragging = false; });
    const onScroll = () => { if (forced) return; spread = reduce ? 1 : Math.min(1, Math.max(0, window.scrollY / 420)); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onView(dc, (v) => { visible = v; }, 0.05);
    onScroll(); draw(); requestAnimationFrame(tick);
  }

  /* ---------- Spondula: handles on a network ---------- */
  const hc = document.getElementById('handles');
  if (hc) {
    const ctx = hc.getContext('2d');
    const W = hc.width, H = hc.height;
    const names = ['waelelhajjar', 'amara', 'jose', 'priya', 'tunde', 'lena', 'jamie', 'marktrinidad'];
    const nodes = names.map((n, i) => {
      const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
      return { n, x: W * 0.5 + Math.cos(a) * W * 0.34, y: H * 0.47 + Math.sin(a) * H * 0.36, bal: 120 + ((i * 37) % 90) };
    });
    let from = null, to = null, flight = null, ledger = [], visible = false, idleT = 0, hover = -1;
    const cap = document.getElementById('cap-handles-hint');
    const send = (a, b) => {
      const amt = 5 + ((a + b + ledger.length) % 6) * 5;
      flight = { a, b, t: 0, amt };
      cap.textContent = `Sending ${amt}.00 GBP-S from #${nodes[a].n} to #${nodes[b].n}.`;
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // faint ring so the network reads as one place, not a bank diagram
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.47, W * 0.34, H * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
      if (flight) {
        const A = nodes[flight.a], B = nodes[flight.b];
        flight.t = Math.min(1, flight.t + 0.018);
        const e = ease(flight.t);
        ctx.strokeStyle = BLUE; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
        const x = A.x + (B.x - A.x) * e, y = A.y + (B.y - A.y) * e;
        ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = F(800, 10); ctx.textAlign = 'center'; ctx.fillText('S', x, y + 3.5); ctx.textAlign = 'left';
        if (flight.t >= 1) {
          A.bal -= flight.amt; B.bal += flight.amt;
          ledger.unshift(`${flight.amt}.00 GBP-S  #${A.n} to #${B.n}  free, instant`);
          ledger = ledger.slice(0, 4);
          cap.textContent = 'Landed. Both sides see it at once. Click two handles to send again.';
          flight = null; from = null; to = null; idleT = 0;
        }
      }
      nodes.forEach((nd, i) => {
        const sel = i === from || i === to, hov = i === hover;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, sel ? 15 : 12, 0, Math.PI * 2);
        ctx.fillStyle = sel ? BLUE : '#fff'; ctx.fill();
        ctx.lineWidth = hov || sel ? 2.5 : 1.5; ctx.strokeStyle = sel ? BLUE : INK; ctx.stroke();
        ctx.fillStyle = INK; ctx.font = F(700, 14);
        const left = nd.x < W * 0.5; ctx.textAlign = left ? 'right' : 'left';
        ctx.fillText('#' + nd.n, nd.x + (left ? -20 : 20), nd.y + 5);
        ctx.font = F(500, 12); ctx.fillStyle = MUTED;
        ctx.fillText(`${nd.bal.toFixed(2)} GBP-S`, nd.x + (left ? -20 : 20), nd.y + 22);
        ctx.textAlign = 'left';
      });
      ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.font = F(800, 13);
      ctx.fillText(ledger.length ? 'Ledger' : 'One network. Handles, not account numbers.', W * 0.5, H * 0.40);
      ctx.font = F(600, 12);
      ledger.forEach((l, i) => { ctx.globalAlpha = 1 - i * 0.22; ctx.fillText(l, W * 0.5, H * 0.40 + 20 + i * 17); });
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    };
    const hit = (e) => {
      const r = hc.getBoundingClientRect(); const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
      return nodes.findIndex((nd) => Math.hypot(nd.x - x, nd.y - y) < 22);
    };
    hc.addEventListener('pointermove', (e) => { hover = hit(e); hc.style.cursor = hover >= 0 ? 'pointer' : 'default'; });
    hc.addEventListener('click', (e) => {
      const i = hit(e); if (i < 0 || flight) return;
      if (from === null) { from = i; cap.textContent = `From #${nodes[i].n}. Now click who gets it.`; }
      else if (i !== from) { to = i; send(from, i); }
    });
    const tick = () => {
      if (visible) {
        draw();
        if (!flight && from === null && !reduce) { idleT++; if (idleT > 170) { const a = Math.floor(Math.random() * nodes.length); let b = Math.floor(Math.random() * nodes.length); if (b === a) b = (a + 3) % nodes.length; from = a; to = b; send(a, b); } }
      }
      requestAnimationFrame(tick);
    };
    onView(hc, (v) => { visible = v; });
    draw(); requestAnimationFrame(tick);
  }

  /* ---------- Real recordings: play only when in view ---------- */
  document.querySelectorAll('.recordings video').forEach((v) => onView(v, (on) => { if (on) v.play().catch(() => {}); else v.pause(); }, 0.3));

  /* ---------- Crimson Desert: quantised surface ---------- */
  const qc = document.getElementById('quant');
  if (qc) {
    const ctx = qc.getContext('2d');
    const bitsEl = document.getElementById('bits'), bitsOut = document.getElementById('bits-out'), bboxEl = document.getElementById('bbox');
    const S = makeSurface(34, 18);
    let angle = 0, bits = 16, showBox = true, visible = false;
    const quant = (p) => p.map((c, k) => { const steps = Math.pow(2, bits) - 1; const u = Math.round(((c - S.min[k]) / S.dim[k]) * steps); return S.min[k] + (u / steps) * S.dim[k]; });
    const draw = () => {
      const w = qc.width, h = qc.height, scale = w * 0.33;
      ctx.clearRect(0, 0, w, h);
      const proj = S.pts.map((p) => project(rotate(quant(p), angle, 0.55), w, h, scale, w / 2, h / 2));
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath();
      for (let i = 0; i < S.U; i++) for (let j = 0; j < S.V; j++) {
        const a = proj[i * S.V + j];
        if (i + 1 < S.U) { const b = proj[(i + 1) * S.V + j]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        if (j + 1 < S.V) { const b = proj[i * S.V + j + 1]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      }
      ctx.stroke();
      ctx.fillStyle = BLUE;
      proj.forEach((p) => { ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * p[2], 0, Math.PI * 2); ctx.fill(); });
      if (showBox) {
        const c = [];
        for (let k = 0; k < 8; k++) c.push(project(rotate([k & 1 ? S.max[0] : S.min[0], k & 2 ? S.max[1] : S.min[1], k & 4 ? S.max[2] : S.min[2]], angle, 0.55), w, h, scale, w / 2, h / 2));
        ctx.strokeStyle = 'rgba(29,78,216,0.8)'; ctx.setLineDash([4, 4]); ctx.beginPath();
        [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a, b]) => { ctx.moveTo(c[a][0], c[a][1]); ctx.lineTo(c[b][0], c[b][1]); });
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = INK; ctx.font = F(600, 14);
      ctx.fillText(`${bits} bits per axis, ${Math.pow(2, bits).toLocaleString('en-GB')} steps across the box`, 16, h - 18);
    };
    const tick = () => { if (visible && !reduce) { angle += 0.006; draw(); } requestAnimationFrame(tick); };
    bitsEl.addEventListener('input', () => { bits = +bitsEl.value; bitsOut.textContent = bits + ' bits'; draw(); });
    bboxEl.addEventListener('change', () => { showBox = bboxEl.checked; draw(); });
    onView(qc, (v) => { visible = v; }, 0.1);
    draw(); requestAnimationFrame(tick);
  }

  /* ---------- vault-brain: walk, reconcile, link on the fixture vault ---------- */
  const gc = document.getElementById('graph');
  if (gc) {
    const ctx = gc.getContext('2d');
    const W = gc.width, H = gc.height;
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
    const draw = (now) => {
      const p = Math.min(1, (now - t0) / 900), e = ease(p);
      ctx.clearRect(0, 0, W, H);
      ctx.font = F(600, 13);
      atoms.forEach((a, i) => {
        const n = byId[a.to];
        const target = (stage >= 1 && n.mergeInto) ? byId[n.mergeInto] : n;
        const k = stage === 0 ? Math.min(1, Math.max(0, (p * 6 - i))) : 1;
        const ax = W * (0.5 + (i % 3 - 1) * 0.25), ay = H * 0.05;
        const x = ax + (target.x * W - ax) * ease(k), y = ay + (target.y * H + 34 + (i % 2) * 14 - ay) * ease(k);
        ctx.fillStyle = MUTED; ctx.fillText(a.text, x + 10, y);
        ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(x, y - 4, 3, 0, Math.PI * 2); ctx.fill();
      });
      if (stage >= 2) {
        ctx.strokeStyle = 'rgba(29,78,216,0.9)'; ctx.lineWidth = 1.5;
        edges.forEach((ed, i) => {
          const a = byId[ed.a], b = byId[ed.b];
          const k = Math.min(1, Math.max(0, p * 4 - i * 0.6)); if (k <= 0) return;
          ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(a.x * W + (b.x * W - a.x * W) * k, a.y * H + (b.y * H - a.y * H) * k); ctx.stroke();
          if (k === 1) { ctx.fillStyle = BLUE; ctx.fillText(ed.t, (a.x + b.x) / 2 * W + 6, (a.y + b.y) / 2 * H - 6); }
        });
      }
      nodes.forEach((n) => {
        if (n.stage === 2 && stage < 2) return;
        let x = n.x * W, y = n.y * H, alpha = 1, r = n.kind === 'insight' ? 16 : 12;
        if (stage >= 1 && n.mergeInto) { const m = byId[n.mergeInto]; x += (m.x * W - x) * e; y += (m.y * H - y) * e; alpha = 1 - e; }
        if (n.stage === 2) alpha = e;
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.kind === 'insight' ? BLUE : n.kind === 'person' ? '#fff' : INK; ctx.fill();
        if (n.kind === 'person') { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fillStyle = INK; ctx.font = F(700, 15); ctx.fillText(n.id, x + r + 8, y + 5);
        ctx.globalAlpha = 1;
      });
      if (stage >= 1) { ctx.fillStyle = MUTED; ctx.font = F(600, 13); ctx.fillText('archived: Orchard release plan, Orchard launch  (status: superseded)', 16, H - 18); }
    };
    const setStage = (s, fromUser) => {
      stage = s; t0 = performance.now(); if (fromUser) auto = false;
      document.querySelectorAll('#fig-graph [data-stage]').forEach((b) => b.classList.toggle('is-on', +b.dataset.stage === s));
      document.getElementById('cap-graph').textContent = captions[s];
    };
    document.querySelectorAll('#fig-graph [data-stage]').forEach((b) => b.addEventListener('click', () => setStage(+b.dataset.stage, true)));
    const tick = (now) => { if (visible) { draw(now); if (auto && !reduce && now - t0 > 3200) setStage((stage + 1) % 3, false); } requestAnimationFrame(tick); };
    onView(gc, (v) => { visible = v; if (v) t0 = performance.now(); }, 0.2);
    requestAnimationFrame(tick);
  }

  /* ---------- The Digital Sandbox: comment to conversation ---------- */
  const fc = document.getElementById('flow');
  if (fc) {
    const ctx = fc.getContext('2d');
    const W = fc.width, H = fc.height;
    const kw = document.getElementById('keyword');
    let t0 = performance.now(), visible = false;
    const lanes = [{ y: 0.22, name: 'Instagram comment' }, { y: 0.50, name: 'Rule: trigger word' }, { y: 0.78, name: 'Direct message' }];
    const bubble = (x, y, text, filled) => {
      ctx.font = F(600, 13); const w = ctx.measureText(text).width + 24;
      ctx.fillStyle = filled ? BLUE : '#fff'; ctx.strokeStyle = filled ? BLUE : INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x, y - 16, w, 32, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = filled ? '#fff' : INK; ctx.fillText(text, x + 12, y + 5);
      return w;
    };
    const draw = (now) => {
      const p = Math.min(1, (now - t0) / 4200);
      const word = (kw.value || 'INFO').toUpperCase();
      ctx.clearRect(0, 0, W, H);
      lanes.forEach((l) => { ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.moveTo(0, l.y * H); ctx.lineTo(W, l.y * H); ctx.stroke(); ctx.fillStyle = MUTED; ctx.font = F(600, 12); ctx.fillText(l.name, 16, l.y * H - 24); });
      // 1. a comment arrives
      const k1 = Math.min(1, p * 4); const x1 = -220 + (200 + 16 + 220) * ease(k1);
      bubble(x1, lanes[0].y * H, `Can I get the price? ${word}`, false);
      // 2. the rule matches and the word lights up
      if (p > 0.3) { const k2 = Math.min(1, (p - 0.3) * 4); ctx.globalAlpha = k2; bubble(216, lanes[1].y * H, `matches "${word}"`, true); ctx.globalAlpha = 1;
        ctx.strokeStyle = BLUE; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(240, lanes[0].y * H + 16); ctx.lineTo(240, lanes[1].y * H - 16 - (1 - k2) * 40); ctx.stroke(); ctx.setLineDash([]); }
      // 3. an automatic reply goes out, then a real conversation continues
      if (p > 0.55) { const k3 = Math.min(1, (p - 0.55) * 4); ctx.globalAlpha = k3; bubble(216 + (1 - k3) * 40, lanes[2].y * H, 'Hi! Prices and today\'s code: BOX10', true); ctx.globalAlpha = 1; }
      if (p > 0.8) { const k4 = Math.min(1, (p - 0.8) * 5); ctx.globalAlpha = k4; bubble(460, lanes[2].y * H + 40, 'Great, ordering now', false); ctx.globalAlpha = 1; }
      ctx.fillStyle = MUTED; ctx.font = F(600, 12); ctx.fillText(p < 1 ? 'running' : 'done in one pass, no one at the business touched it', W - 300, H - 14);
    };
    const tick = (now) => { if (visible) draw(now); requestAnimationFrame(tick); };
    document.getElementById('run-flow').addEventListener('click', () => { t0 = performance.now(); });
    kw.addEventListener('input', () => { t0 = performance.now(); });
    onView(fc, (v) => { visible = v; if (v) t0 = performance.now(); }, 0.3);
    requestAnimationFrame(tick);
    const loadBtn = document.getElementById('load-tds');
    loadBtn.addEventListener('click', () => {
      const f = document.getElementById('tds-frame'); const b = document.getElementById('tds-browser');
      if (!f.src) f.src = 'https://thedigitalsandbox.co.uk/';
      b.classList.toggle('is-hidden');
      loadBtn.textContent = b.classList.contains('is-hidden') ? 'Open the live site here' : 'Hide the live site';
    });
  }

  /* ---------- Fincore: the OCEAN profile ---------- */
  const oc = document.getElementById('ocean');
  if (oc) {
    const ctx = oc.getContext('2d');
    const W = oc.width, H = oc.height;
    const traits = ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism'];
    const vals = [72, 45, 81, 63, 38], shown = [...vals];
    const notes = [
      (v) => v > 60 ? 'novelty spending is your risk' : 'novelty is not your problem',
      (v) => v < 50 ? 'plans slip; budgets need automation' : 'you keep to a plan',
      (v) => v > 60 ? 'social spending runs ahead of you' : 'social spending is steady',
      (v) => v > 60 ? 'you say yes to others\' plans' : 'you hold your own line',
      (v) => v > 60 ? 'stress spending shows up' : 'calm under pressure'
    ];
    let visible = false;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.27, cy = H * 0.52, R = H * 0.34;
      for (let ring = 1; ring <= 4; ring++) { ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5, r = R * ring / 4; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); }
      vals.forEach((v, i) => { shown[i] += (v - shown[i]) * (reduce ? 1 : 0.12); });
      ctx.beginPath();
      shown.forEach((v, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5, r = R * v / 100; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fillStyle = 'rgba(29,78,216,0.15)'; ctx.fill(); ctx.strokeStyle = BLUE; ctx.lineWidth = 2; ctx.stroke();
      shown.forEach((v, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5, r = R * v / 100; ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4, 0, Math.PI * 2); ctx.fill();
        const lx = cx + Math.cos(a) * (R + 18), ly = cy + Math.sin(a) * (R + 18);
        ctx.fillStyle = INK; ctx.font = F(700, 12); ctx.textAlign = Math.cos(a) < -0.1 ? 'right' : Math.cos(a) > 0.1 ? 'left' : 'center'; ctx.fillText(traits[i], lx, ly + 4); ctx.textAlign = 'left'; });
      // the reading on the right
      const x0 = W * 0.60;
      ctx.fillStyle = INK; ctx.font = F(800, 18); ctx.fillText('Your reading', x0, H * 0.18);
      traits.forEach((t, i) => { const y = H * 0.30 + i * 30; ctx.fillStyle = MUTED; ctx.font = F(600, 12); ctx.fillText(`${t} ${Math.round(shown[i])}`, x0, y); ctx.fillStyle = INK; ctx.font = F(500, 12); ctx.fillText(notes[i](vals[i]), x0, y + 14); });
      const cost = Math.round(120 + vals[0] * 4.2 + (100 - vals[1]) * 3.1 + vals[2] * 3.6 + vals[4] * 2.4);
      ctx.fillStyle = INK; ctx.font = F(800, 22); ctx.fillText(`${cost.toLocaleString('en-GB')} GBP a year`, x0, H * 0.30 + 5 * 30 + 18);
      ctx.fillStyle = MUTED; ctx.font = F(600, 12); ctx.fillText('estimated cost of leaving these traits unmanaged', x0, H * 0.30 + 5 * 30 + 36);
    };
    document.querySelectorAll('#fig-ocean input[type="range"]').forEach((r) => r.addEventListener('input', () => { vals[+r.dataset.trait] = +r.value; }));
    const tick = () => { if (visible) draw(); requestAnimationFrame(tick); };
    onView(oc, (v) => { visible = v; }, 0.2);
    draw(); requestAnimationFrame(tick);
  }
})();
