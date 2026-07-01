import { getAllItems, saveItem } from './db.js';
import { activateScreen, pushScreen } from './nav.js';

const RELAY = 'https://tteoreum-relay.vercel.app';
const STAR = '#D9E6FF';
const GOLD = '#FFD27A';
const FAMILY = ['#7FA8FF', '#B79CFF', '#6FE0C9', '#E0A9D8'];

export function showGraph() {
  pushScreen({ screen: 'graph' });
  return renderGraphScreen();
}

export async function renderGraphScreen() {
  const screen = document.getElementById('graph-screen');
  activateScreen('graph-screen');

  screen.innerHTML = `
    <div class="graph-topbar">
      <button class="graph-back-btn" id="graph-back">← 인박스</button>
      <span class="graph-label">별자리</span>
      <span class="graph-count" id="graph-count"></span>
    </div>
    <div class="nebula gn1"></div>
    <div class="nebula gn2"></div>
    <div class="nebula gn3"></div>
    <div class="vignette"></div>
    <svg id="graph-svg"></svg>
    <div class="graph-legend">
      <span><i class="gl-hub"></i>구심점</span>
      <span><i class="gl-conn"></i>연결된 별</span>
      <span><i class="gl-iso"></i>미연결</span>
    </div>
    <div class="graph-hint" id="graph-hint">태그 분석 중…</div>
  `;

  document.getElementById('graph-back').addEventListener('click', () => history.back());

  const allItems = await getAllItems();
  const active = allItems.filter(i => i.status !== 'discarded');

  // 태그 없는 항목 자동 태깅 (배치)
  const untagged = active.filter(i => !i.tags || i.tags.length === 0);
  if (untagged.length > 0) {
    try {
      const res = await fetch(`${RELAY}/api/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: untagged.map(i => ({ id: i.id, content: i.content })) }),
      });
      if (res.ok) {
        const { result } = await res.json();
        for (const r of result) {
          const item = allItems.find(i => i.id === r.id);
          if (item) {
            item.tags = r.tags;
            await saveItem(item);
          }
        }
      }
    } catch (e) {
      console.warn('auto-tag failed:', e.message);
    }
  }

  const hint = document.getElementById('graph-hint');
  if (hint) hint.remove();
  document.getElementById('graph-count').textContent = `${active.length}개 항목`;

  renderD3(active);
}

function renderD3(items) {
  const D3_URL = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';

  if (window.d3) {
    buildGraph(items);
    return;
  }

  const script = document.createElement('script');
  script.src = D3_URL;
  script.onload = () => buildGraph(items);
  document.head.appendChild(script);
}

function buildGraph(items) {
  const d3 = window.d3;
  const svgEl = document.getElementById('graph-svg');
  if (!svgEl) return;

  const W = svgEl.clientWidth || window.innerWidth;
  const H = svgEl.clientHeight || window.innerHeight;

  // 노드·링크 빌드
  const nodes = items.map(i => ({ id: i.id, label: i.content.slice(0, 30), tags: i.tags || [], item: i }));
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].tags.some(t => nodes[j].tags.includes(t))) {
        links.push({ source: nodes[i].id, target: nodes[j].id });
      }
    }
  }

  const degree = {};
  nodes.forEach(n => degree[n.id] = 0);
  links.forEach(l => { degree[l.source]++; degree[l.target]++; });

  // 클러스터 + 허브 탐지
  const adj = {};
  nodes.forEach(n => adj[n.id] = new Set());
  links.forEach(l => { adj[l.source].add(l.target); adj[l.target].add(l.source); });

  const visited = new Set();
  const clusters = [];
  nodes.forEach(n => {
    if (visited.has(n.id) || degree[n.id] === 0) return;
    const stack = [n.id], members = [];
    visited.add(n.id);
    while (stack.length) {
      const cur = stack.pop(); members.push(cur);
      adj[cur].forEach(nb => { if (!visited.has(nb)) { visited.add(nb); stack.push(nb); } });
    }
    const hub = members.reduce((a, b) => degree[b] > degree[a] ? b : a, members[0]);
    clusters.push({ members, hub });
  });

  const nodeFamily = {}, nodeIsHub = {};
  clusters.forEach((c, i) => {
    const color = FAMILY[i % FAMILY.length];
    c.members.forEach(id => { nodeFamily[id] = color; nodeIsHub[id] = (id === c.hub); });
  });

  function restColor(id) {
    if (degree[id] === 0) return '#5A5F75';
    const fam = nodeFamily[id];
    if (nodeIsHub[id]) return fam;
    return d3.interpolateRgb(fam, STAR)(0.6);
  }

  const svg = d3.select('#graph-svg');
  svg.selectAll('*').remove();

  // 별빛 배경 점
  const starsLayer = svg.append('g');
  for (let i = 0; i < 55; i++) {
    starsLayer.append('circle')
      .attr('cx', Math.random() * W).attr('cy', Math.random() * H)
      .attr('r', 0.5 + Math.random() * 1.1)
      .attr('fill', STAR).attr('opacity', 0.25 + Math.random() * 0.4)
      .style('animation', `twinkle ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 3}s infinite`);
  }

  const defs = svg.append('defs');
  const glowF = defs.append('filter').attr('id', 'starglow').attr('x', '-300%').attr('y', '-300%').attr('width', '700%').attr('height', '700%');
  glowF.append('feGaussianBlur').attr('stdDeviation', 5);
  const goldF = defs.append('filter').attr('id', 'goldglow').attr('x', '-400%').attr('y', '-400%').attr('width', '900%').attr('height', '900%');
  goldF.append('feGaussianBlur').attr('stdDeviation', 8);

  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.5, 2.5]).on('zoom', e => g.attr('transform', e.transform)));

  const linkSel = g.append('g').selectAll('line').data(links).join('line')
    .attr('stroke', 'rgba(217,230,255,0.16)').attr('stroke-width', 1);

  const nodeSel = g.append('g').selectAll('g.node').data(nodes).join('g')
    .attr('class', 'node').style('cursor', 'pointer');

  const glow = nodeSel.append('circle')
    .attr('r', d => (9 + Math.min(degree[d.id], 4) * 2.6) * (nodeIsHub[d.id] ? 2.1 : 1.7))
    .attr('fill', d => restColor(d.id))
    .attr('opacity', d => degree[d.id] === 0 ? 0.08 : (nodeIsHub[d.id] ? 0.3 : 0.18))
    .attr('filter', 'url(#starglow)');

  const core = nodeSel.append('circle')
    .attr('r', d => (4.5 + Math.min(degree[d.id], 4) * 2.2) * (nodeIsHub[d.id] ? 1.25 : 1))
    .attr('fill', d => restColor(d.id)).attr('opacity', 0)
    .style('animation', (d, i) => `twinkle ${3 + (i % 5) * 0.5}s ease-in-out ${(i % 7) * 0.4}s infinite`)
    .style('transform-box', 'fill-box').style('transform-origin', 'center');

  const labels = nodeSel.append('text').text(d => d.label)
    .attr('font-size', 9.5).attr('dy', d => -(13 + Math.min(degree[d.id], 4) * 2.2))
    .attr('text-anchor', 'middle').attr('opacity', 0).attr('fill', '#EAEFFF')
    .style('pointer-events', 'none').style('font-family', '-apple-system, sans-serif');

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(74).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-170))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collide', d3.forceCollide(d => 15 + Math.min(degree[d.id], 4) * 2.6))
    .alphaDecay(0.03)
    .on('tick', () => {
      linkSel.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
             .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    });

  core.transition().delay((d, i) => i * 80).duration(600)
    .ease(d3.easeBackOut.overshoot(1.6)).attr('opacity', 0.85);

  nodeSel.call(d3.drag()
    .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

  function neighborsOf(id) {
    const s = new Set([id]);
    links.forEach(l => {
      const a = typeof l.source === 'object' ? l.source.id : l.source;
      const b = typeof l.target === 'object' ? l.target.id : l.target;
      if (a === id) s.add(b); if (b === id) s.add(a);
    });
    return s;
  }

  let focused = null;
  let tapTimer = null;

  nodeSel.on('click', (e, d) => {
    e.stopPropagation();
    if (focused === d.id) {
      // 이미 포커스된 노드 재탭 → 상세 화면으로 이동
      if (tapTimer) {
        clearTimeout(tapTimer);
        tapTimer = null;
        goDetail(d.item.id);
        return;
      }
      tapTimer = setTimeout(() => { tapTimer = null; focused = null; applyFocus(); }, 350);
    } else {
      focused = d.id;
      applyFocus();
    }
  });

  svg.on('click', e => {
    if (e.target.tagName === 'svg') { focused = null; applyFocus(); }
  });

  function applyFocus() {
    if (!focused) {
      core.transition().duration(400).attr('fill', d => restColor(d.id)).attr('opacity', 0.85);
      glow.transition().duration(400).attr('fill', d => restColor(d.id))
          .attr('opacity', d => degree[d.id] === 0 ? 0.08 : (nodeIsHub[d.id] ? 0.3 : 0.18))
          .attr('filter', 'url(#starglow)');
      labels.transition().duration(350).attr('opacity', 0);
      linkSel.transition().duration(350).attr('stroke', 'rgba(217,230,255,0.16)')
             .attr('stroke-width', 1).attr('stroke-dasharray', null);
      cancelAnimationFrame(_flowRAF);
      return;
    }
    const keep = neighborsOf(focused);
    core.transition().duration(400)
      .attr('fill', d => keep.has(d.id) ? GOLD : restColor(d.id))
      .attr('opacity', d => keep.has(d.id) ? 1 : 0.1);
    glow.transition().duration(400)
      .attr('fill', d => keep.has(d.id) ? GOLD : restColor(d.id))
      .attr('filter', d => keep.has(d.id) ? 'url(#goldglow)' : 'url(#starglow)')
      .attr('opacity', d => keep.has(d.id) ? 0.55 : 0.03);
    labels.transition().duration(350).attr('opacity', d => keep.has(d.id) ? 1 : 0);
    linkSel.transition().duration(350)
      .attr('stroke', l => {
        const a = typeof l.source === 'object' ? l.source.id : l.source;
        const b = typeof l.target === 'object' ? l.target.id : l.target;
        return (a === focused || b === focused) ? GOLD : 'rgba(217,230,255,0.03)';
      })
      .attr('stroke-width', l => {
        const a = typeof l.source === 'object' ? l.source.id : l.source;
        const b = typeof l.target === 'object' ? l.target.id : l.target;
        return (a === focused || b === focused) ? 1.8 : 1;
      })
      .attr('stroke-dasharray', l => {
        const a = typeof l.source === 'object' ? l.source.id : l.source;
        const b = typeof l.target === 'object' ? l.target.id : l.target;
        return (a === focused || b === focused) ? '3 5' : null;
      });
    animateFlow();
  }

  let _flowRAF;
  function animateFlow() {
    cancelAnimationFrame(_flowRAF);
    let off = 0;
    const step = () => {
      off -= 0.5;
      linkSel.filter(l => {
        const a = typeof l.source === 'object' ? l.source.id : l.source;
        const b = typeof l.target === 'object' ? l.target.id : l.target;
        return a === focused || b === focused;
      }).attr('stroke-dashoffset', off);
      if (focused) _flowRAF = requestAnimationFrame(step);
    };
    step();
  }

  function goDetail(id) {
    import('./detail.js').then(m => m.showDetail(id));
  }
}
