import { getAllItems, saveItem } from './db.js';
import { activateScreen, pushScreen } from './nav.js';
import { showConfirm } from './confirm.js';
import { haptic } from './haptics.js';

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
      <div class="graph-topbar-right">
        <span class="graph-count" id="graph-count"></span>
        <button class="graph-retag-btn" id="graph-retag" title="태그 다시 분류">↻</button>
      </div>
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
  document.getElementById('graph-retag').addEventListener('click', async () => {
    const ok = await showConfirm('모든 항목의 태그를 다시 분류할까요? 시간이 좀 걸릴 수 있어요.', '다시 분류', '취소');
    if (!ok) return;
    haptic();
    const allItems = await getAllItems();
    const active = allItems.filter(i => i.status !== 'discarded');
    for (const item of active) {
      item.tags = [];
      await saveItem(item);
    }
    await renderGraphScreen();
  });

  const allItems = await getAllItems();
  const active = allItems.filter(i => i.status !== 'discarded');

  // 태그 없는 항목 자동 태깅 (배치) — 기존 태그 어휘를 함께 보내 재사용 유도 (연결 잘 되게)
  const untagged = active.filter(i => !i.tags || i.tags.length === 0);
  if (untagged.length > 0) {
    const tagCounts = {};
    active.forEach(i => (i.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const existingTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

    try {
      const res = await fetch(`${RELAY}/api/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: untagged.map(i => ({ id: i.id, content: i.content })),
          existingTags,
        }),
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
  const nodes = items.map(i => ({
    id: i.id,
    label: i.content.length > 12 ? i.content.slice(0, 12) + '…' : i.content,
    tags: i.tags || [],
    item: i,
  }));
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

  // 클러스터 이름: 구성원들이 가장 많이 공유하는 태그를 별자리 이름으로 사용
  const clusterName = {};
  clusters.forEach(c => {
    const tagCounts = {};
    c.members.forEach(id => {
      const n = nodes.find(nn => nn.id === id);
      (n.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });
    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    clusterName[c.hub] = sorted[0]?.[0] || null;
  });

  function restColor(id) {
    if (degree[id] === 0) return '#9AA2C4';
    const fam = nodeFamily[id];
    if (nodeIsHub[id]) return fam;
    return d3.interpolateRgb(fam, STAR)(0.6);
  }

  const svg = d3.select('#graph-svg');
  svg.selectAll('*').remove();

  // 별빛 배경 점 (데이터 별과 구분되게 더 은은하게)
  const starsLayer = svg.append('g');
  for (let i = 0; i < 55; i++) {
    starsLayer.append('circle')
      .attr('cx', Math.random() * W).attr('cy', Math.random() * H)
      .attr('r', 0.5 + Math.random() * 1.1)
      .attr('fill', STAR).attr('opacity', 0.12 + Math.random() * 0.2)
      .style('animation', `twinkle ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 3}s infinite`);
  }

  const defs = svg.append('defs');
  const glowF = defs.append('filter').attr('id', 'starglow').attr('x', '-300%').attr('y', '-300%').attr('width', '700%').attr('height', '700%');
  glowF.append('feGaussianBlur').attr('stdDeviation', 7);
  const goldF = defs.append('filter').attr('id', 'goldglow').attr('x', '-400%').attr('y', '-400%').attr('width', '900%').attr('height', '900%');
  goldF.append('feGaussianBlur').attr('stdDeviation', 10);

  const g = svg.append('g');
  const zoomBehavior = d3.zoom().scaleExtent([0.15, 2.5]).on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoomBehavior);

  const linkSel = g.append('g').selectAll('line').data(links).join('line')
    .attr('stroke', 'rgba(217,230,255,0.16)').attr('stroke-width', 1);

  const nodeSel = g.append('g').selectAll('g.node').data(nodes).join('g')
    .attr('class', 'node').style('cursor', 'pointer');

  // 연결된 별(허브 아님, degree>0)은 살짝 축소
  function sizeShrink(d) {
    return (!nodeIsHub[d.id] && degree[d.id] > 0) ? 0.85 : 1;
  }

  const glow = nodeSel.append('circle')
    .attr('r', d => (11 + Math.min(degree[d.id], 4) * 2.6) * (nodeIsHub[d.id] ? 1.5 : 1.25) * sizeShrink(d))
    .attr('fill', d => restColor(d.id))
    .attr('opacity', d => degree[d.id] === 0 ? 0.16 : (nodeIsHub[d.id] ? 0.26 : 0.16))
    .attr('filter', 'url(#starglow)');

  // 4방향 반짝임 모양 경로 생성 (구심점 전용)
  function sparkPath(r) {
    const k = r * 0.22;
    return `M0 ${-r} L${k} ${-k} L${r} 0 L${k} ${k} L0 ${r} L${-k} ${k} L${-r} 0 L${-k} ${-k} Z`;
  }

  const coreCircle = nodeSel.filter(d => !nodeIsHub[d.id]).append('circle')
    .attr('class', 'core-shape')
    .attr('r', d => (6 + Math.min(degree[d.id], 4) * 2.2) * sizeShrink(d))
    .attr('fill', d => restColor(d.id)).attr('opacity', 0)
    .style('animation', (d, i) => `twinkle ${3 + (i % 5) * 0.5}s ease-in-out ${(i % 7) * 0.4}s infinite`)
    .style('transform-box', 'fill-box').style('transform-origin', 'center');

  const coreSpark = nodeSel.filter(d => nodeIsHub[d.id]).append('path')
    .attr('class', 'core-shape')
    .attr('d', d => sparkPath((7 + Math.min(degree[d.id], 4) * 2.4) * 1.3))
    .attr('fill', d => restColor(d.id)).attr('opacity', 0)
    .style('animation', (d, i) => `twinkle ${3 + (i % 5) * 0.5}s ease-in-out ${(i % 7) * 0.4}s infinite`)
    .style('transform-box', 'fill-box').style('transform-origin', 'center');

  const core = nodeSel.selectAll('.core-shape');

  // 긴급 표시된 항목은 금색 테두리로 표시 (인박스 별 배지와 동일 의미)
  function coreRadius(d) {
    return nodeIsHub[d.id]
      ? (7 + Math.min(degree[d.id], 4) * 2.4) * 1.3
      : (6 + Math.min(degree[d.id], 4) * 2.2) * sizeShrink(d);
  }
  const urgentRing = nodeSel.filter(d => d.item.urgent).append('circle')
    .attr('class', 'urgent-ring')
    .attr('r', d => coreRadius(d) + 4)
    .attr('fill', 'none')
    .attr('stroke', GOLD).attr('stroke-width', 1.4)
    .attr('opacity', 0)
    .style('pointer-events', 'none');

  const labels = nodeSel.append('text').text(d => d.label)
    .attr('font-size', 9.5).attr('dy', d => -(13 + Math.min(degree[d.id], 4) * 2.2))
    .attr('text-anchor', 'middle').attr('opacity', 0).attr('fill', '#EAEFFF')
    .attr('stroke', 'rgba(6,8,20,0.85)').attr('stroke-width', 3)
    .style('paint-order', 'stroke').style('pointer-events', 'none')
    .style('font-family', '-apple-system, sans-serif');

  // 구심점 위에 별자리 이름(공유 태그) 항상 표시 — 별 묶음을 한눈에 구분
  const clusterLabels = nodeSel.filter(d => nodeIsHub[d.id] && degree[d.id] > 0 && clusterName[d.id])
    .append('text').text(d => `✦ ${clusterName[d.id]}`)
    .attr('font-size', 11).attr('font-weight', 600)
    .attr('dy', d => -(26 + Math.min(degree[d.id], 4) * 2.2))
    .attr('text-anchor', 'middle').attr('opacity', 0)
    .attr('fill', d => nodeFamily[d.id])
    .attr('stroke', 'rgba(6,8,20,0.85)').attr('stroke-width', 3)
    .style('paint-order', 'stroke').style('pointer-events', 'none')
    .style('font-family', '-apple-system, sans-serif');

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(100).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('x', d3.forceX(W / 2).strength(0.04))
    .force('y', d3.forceY(H / 2).strength(0.04))
    .force('collide', d3.forceCollide(d => 26 + Math.min(degree[d.id], 4) * 2.6))
    .alphaDecay(0.03)
    .on('tick', () => {
      linkSel.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
             .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    })
    .on('end', () => fitToView());

  // 별자리가 다 퍼진 뒤 전체가 한 화면에 들어오도록 자동 줌아웃
  // (메모가 늘어나 별자리가 커져도 화면 밖으로 사라지는 별이 없게)
  function fitToView() {
    const xs = nodes.map(d => d.x), ys = nodes.map(d => d.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const graphW = Math.max(maxX - minX, 1);
    const graphH = Math.max(maxY - minY, 1);
    const pad = 70;
    const scale = Math.min((W - pad * 2) / graphW, (H - pad * 2) / graphH, 0.85);
    const scaleClamped = Math.max(scale, 0.15);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const transform = d3.zoomIdentity
      .translate(W / 2, H / 2)
      .scale(scaleClamped)
      .translate(-cx, -cy);
    svg.transition().duration(600).call(zoomBehavior.transform, transform);
  }

  // 탭한 별(+ 연결된 별들)이 화면을 채우도록 살짝 확대
  function zoomToFocus(id) {
    const keep = neighborsOf(id);
    const relevant = nodes.filter(n => keep.has(n.id));
    const xs = relevant.map(n => n.x), ys = relevant.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = Math.max(maxX - minX, 40), h = Math.max(maxY - minY, 40);
    const pad = 80;
    const scale = Math.min((W - pad * 2) / w, (H - pad * 2) / h, 2.2);
    const scaleClamped = Math.max(scale, 0.6);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const transform = d3.zoomIdentity
      .translate(W / 2, H / 2)
      .scale(scaleClamped)
      .translate(-cx, -cy);
    svg.transition().duration(500).call(zoomBehavior.transform, transform);
  }

  core.transition().delay((d, i) => i * 80).duration(600)
    .ease(d3.easeBackOut.overshoot(1.6)).attr('opacity', 0.95);
  clusterLabels.transition().delay((d, i) => i * 80 + 300).duration(500).attr('opacity', 0.8);
  urgentRing.transition().delay((d, i) => i * 80 + 200).duration(500).attr('opacity', 0.75);

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
      tapTimer = setTimeout(() => { tapTimer = null; focused = null; applyFocus(); fitToView(); }, 350);
    } else {
      focused = d.id;
      applyFocus();
      zoomToFocus(d.id);
    }
  });

  svg.on('click', e => {
    if (e.target.tagName === 'svg') { focused = null; applyFocus(); fitToView(); }
  });

  function applyFocus() {
    if (!focused) {
      core.transition().duration(400).attr('fill', d => restColor(d.id)).attr('opacity', 0.85);
      glow.transition().duration(400).attr('fill', d => restColor(d.id))
          .attr('opacity', d => degree[d.id] === 0 ? 0.08 : (nodeIsHub[d.id] ? 0.22 : 0.14))
          .attr('filter', 'url(#starglow)');
      labels.transition().duration(350).attr('opacity', 0);
      clusterLabels.transition().duration(350).attr('opacity', 0.8);
      urgentRing.transition().duration(350).attr('opacity', 0.75);
      linkSel.transition().duration(350).attr('stroke', 'rgba(217,230,255,0.16)')
             .attr('stroke-width', 1).attr('stroke-dasharray', null);
      cancelAnimationFrame(_flowRAF);
      return;
    }
    const keep = neighborsOf(focused);
    clusterLabels.transition().duration(350).attr('opacity', d => keep.has(d.id) ? 1 : 0.12);
    urgentRing.transition().duration(350).attr('opacity', d => keep.has(d.id) ? 0.9 : 0.08);
    core.transition().duration(400)
      .attr('fill', d => keep.has(d.id) ? GOLD : restColor(d.id))
      .attr('opacity', d => keep.has(d.id) ? 1 : 0.1);
    glow.transition().duration(400)
      .attr('fill', d => keep.has(d.id) ? GOLD : restColor(d.id))
      .attr('filter', d => keep.has(d.id) ? 'url(#goldglow)' : 'url(#starglow)')
      .attr('opacity', d => keep.has(d.id) ? 0.4 : 0.03);
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
