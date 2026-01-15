import React, { useState, useEffect, useRef } from 'react';

// Graph-based membrane: closed curve boundary with internal coupling edges.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const NODE_MIN = 14;
const NODE_MAX = 28;

const minExtraEdgesFor = (nodeCount) => Math.max(2, Math.floor(nodeCount * 0.15));
const maxExtraEdgesFor = (nodeCount) => Math.max(minExtraEdgesFor(nodeCount) + 1, Math.floor(nodeCount * 0.6));

const randomType = () => {
  const r = Math.random();
  if (r < 0.2) return 'etc';
  if (r < 0.35) return 'synthase';
  return 'membrane';
};

const createRandomNode = () => ({
  type: randomType(),
  sBias: Math.random(),
  leak: 0.01 + Math.random() * 0.06,
});

const ringDistance = (a, b, n) => Math.min(Math.abs(a - b), n - Math.abs(a - b));
const isEdgeAllowed = (from, to, nodeCount) => from !== to && ringDistance(from, to, nodeCount) > 1;
const edgeKey = (from, to) => (from < to ? `${from}-${to}` : `${to}-${from}`);

function createRandomEdge(nodeCount) {
  let from = 0;
  let to = 0;
  let tries = 0;

  while (tries < 20) {
    from = randInt(0, nodeCount - 1);
    to = randInt(0, nodeCount - 1);
    if (isEdgeAllowed(from, to, nodeCount)) break;
    tries += 1;
  }

  if (!isEdgeAllowed(from, to, nodeCount)) {
    to = (from + 2) % nodeCount;
  }

  return {
    from,
    to,
    weight: 0.3 + Math.random() * 0.7,
    curvature: (Math.random() - 0.5) * 1.2,
  };
}

function addEdgeUnique(edges, edge, nodeCount, usedKeys) {
  if (!isEdgeAllowed(edge.from, edge.to, nodeCount)) return false;
  const key = edgeKey(edge.from, edge.to);
  if (usedKeys.has(key)) return false;
  usedKeys.add(key);

  edges.push({
    from: edge.from,
    to: edge.to,
    weight: clamp(edge.weight, 0.1, 1),
    curvature: clamp(edge.curvature, -1.2, 1.2),
  });

  return true;
}

function normalizeExtraEdges(edges, nodeCount) {
  const used = new Set();
  const cleaned = [];
  edges.forEach(edge => addEdgeUnique(cleaned, edge, nodeCount, used));

  const minEdges = minExtraEdgesFor(nodeCount);
  const maxEdges = maxExtraEdgesFor(nodeCount);

  while (cleaned.length > maxEdges) {
    cleaned.splice(randInt(0, cleaned.length - 1), 1);
  }
  while (cleaned.length < minEdges) {
    addEdgeUnique(cleaned, createRandomEdge(nodeCount), nodeCount, used);
  }

  return cleaned;
}

function createGenome() {
  const nodeCount = randInt(16, 24);
  const nodes = Array.from({ length: nodeCount }, () => createRandomNode());
  const edgeCount = randInt(minExtraEdgesFor(nodeCount), maxExtraEdgesFor(nodeCount));
  const edges = normalizeExtraEdges(
    Array.from({ length: edgeCount }, () => createRandomEdge(nodeCount)),
    nodeCount
  );

  return {
    nodeCount,
    radiusX: 0.45 + Math.random() * 0.35,
    radiusY: 0.45 + Math.random() * 0.35,
    pocketAmp: 0.06 + Math.random() * 0.18,
    pocketFreq: 1 + Math.random() * 4,
    pocketPhase: Math.random() * Math.PI * 2,
    angleJitter: Math.random() * 0.2,
    angleJitterFreq: 1 + Math.random() * 3,
    angleJitterPhase: Math.random() * Math.PI * 2,
    folds: Array(7).fill(0).map(() => ({
      freq: 0.6 + Math.random() * 5.5,
      amp: (Math.random() - 0.4) * 0.2,
      phase: Math.random() * Math.PI * 2,
    })),
    thickness: 0.03 + Math.random() * 0.03,
    porosity: 0.25 + Math.random() * 0.45,
    resonanceThreshold: 0.3 + Math.random() * 0.3,
    couplingStrength: 0.2 + Math.random() * 0.5,
    alignmentBias: 0.3 + Math.random() * 0.4,
    alignmentVariance: 0.1 + Math.random() * 0.25,
    edgeWeight: 0.45 + Math.random() * 0.4,
    nodes,
    edges,
  };
}

function buildMembraneGraph(genome, scale) {
  const n = genome.nodeCount;
  const nodes = [];
  const edges = [];
  const baseNodes = genome.nodes.length
    ? genome.nodes
    : Array.from({ length: n }, () => ({ type: 'membrane', sBias: 0.5, leak: 0.03 }));
  const ringWeight = clamp(genome.edgeWeight, 0.2, 1);

  for (let i = 0; i < n; i++) {
    const t = i / n;
    const angle = t * Math.PI * 2;
    const jitter = Math.sin(angle * genome.angleJitterFreq + genome.angleJitterPhase) * genome.angleJitter;
    const warped = angle + jitter;

    let foldOffset = 0;
    genome.folds.forEach(fold => {
      foldOffset += fold.amp * Math.sin(fold.freq * angle + fold.phase);
    });
    foldOffset += genome.pocketAmp * Math.sin(angle * genome.pocketFreq + genome.pocketPhase);
    foldOffset = clamp(foldOffset, -0.35, 0.35);

    const baseX = Math.cos(warped) * genome.radiusX * scale;
    const baseY = Math.sin(warped) * genome.radiusY * scale;
    const normalAngle = warped + Math.PI / 2;

    const x = baseX + Math.cos(normalAngle) * foldOffset * scale;
    const y = baseY + Math.sin(normalAngle) * foldOffset * scale;

    const baseNode = baseNodes[i] || baseNodes[baseNodes.length - 1] || { type: 'membrane', sBias: 0.5, leak: 0.03 };
    const sWave = Math.sin(t * Math.PI * 4 + genome.alignmentVariance * 8);
    const s = clamp(genome.alignmentBias + (baseNode.sBias - 0.5) * 0.6 + sWave * genome.alignmentVariance, 0, 1);
    const leak = clamp(baseNode.leak + (1 - s) * 0.03, 0.005, 0.12);

    nodes.push({ id: i, type: baseNode.type, x, y, s, leak });
  }

  for (let i = 0; i < n; i++) {
    edges.push({ from: i, to: (i + 1) % n, weight: ringWeight, curvature: 0, ring: true });
  }

  genome.edges.forEach(edge => {
    if (edge.from < n && edge.to < n && isEdgeAllowed(edge.from, edge.to, n)) {
      edges.push({
        from: edge.from,
        to: edge.to,
        weight: clamp(edge.weight, 0.1, 1),
        curvature: clamp(edge.curvature, -1.2, 1.2),
        ring: false,
      });
    }
  });

  return { nodes, edges };
}

function simulateFitness(genome, useQuantum) {
  const graph = buildMembraneGraph(genome, 36);
  const { nodes, edges } = graph;
  const n = nodes.length;

  const H = new Array(n).fill(0);
  const A = new Array(n).fill(0);
  const q = new Array(n).fill(0);

  let sources = nodes.filter(node => node.type === 'etc').map(node => node.id);
  let synthases = nodes.filter(node => node.type === 'synthase').map(node => node.id);

  if (sources.length === 0) {
    sources = [0, Math.floor(n / 3), Math.floor((2 * n) / 3)];
  }
  if (synthases.length === 0) {
    synthases = [Math.floor(n / 6), Math.floor(n / 2), Math.floor((5 * n) / 6)];
  }

  sources = [...new Set(sources.map(i => i % n))];
  synthases = [...new Set(synthases.map(i => i % n))];

  const reserved = new Set([...sources, ...synthases]);
  const sinkCount = Math.max(2, Math.floor(n * 0.12));
  const sinks = [];

  [...nodes]
    .sort((a, b) => b.leak - a.leak)
    .forEach(node => {
      if (sinks.length < sinkCount && !reserved.has(node.id)) {
        sinks.push(node.id);
      }
    });

  if (sinks.length === 0) {
    sinks.push(Math.floor(n / 4), Math.floor((3 * n) / 4));
  }

  const neighborMap = Array.from({ length: n }, () => []);
  edges.forEach(edge => {
    const weight = clamp(edge.weight, 0.1, 1);
    neighborMap[edge.from].push({ id: edge.to, weight });
    neighborMap[edge.to].push({ id: edge.from, weight });
  });

  let delivered = 0;
  let leaked = 0;
  let coherenceSum = 0;
  let coherenceCount = 0;

  const steps = 120;

  for (let step = 0; step < steps; step++) {
    sources.forEach(i => {
      H[i] += 0.9;
    });

    if (useQuantum) {
      for (let i = 0; i < n; i++) {
        let weightSum = 0;
        let alignment = 0;

        neighborMap[i].forEach(neighbor => {
          alignment += nodes[i].s * nodes[neighbor.id].s * neighbor.weight;
          weightSum += neighbor.weight;
        });

        const localAlignment = weightSum > 0 ? alignment / weightSum : 0;
        const activation = localAlignment - genome.resonanceThreshold;
        q[i] = 1 / (1 + Math.exp(-8 * activation));

        coherenceSum += q[i];
        coherenceCount += 1;
      }
    }

    const dH = new Array(n).fill(0);
    edges.forEach(edge => {
      const i = edge.from;
      const j = edge.to;
      let conductance = genome.porosity * (0.2 + 0.6 * edge.weight);

      if (useQuantum) {
        conductance *= 1 + genome.couplingStrength * (q[i] + q[j]) / 2;
      }

      const flux = conductance * (H[j] - H[i]);
      dH[i] += flux;
      dH[j] -= flux;
    });

    for (let i = 0; i < n; i++) {
      H[i] = Math.max(0, H[i] + dH[i]);
    }

    nodes.forEach((node, i) => {
      const loss = H[i] * node.leak;
      H[i] -= loss;
      leaked += loss;
    });

    synthases.forEach(i => {
      let efficiency = 0.25;
      if (useQuantum && q[i] > 0.5) {
        efficiency *= 1 + genome.couplingStrength * 0.7;
      }
      const production = H[i] * efficiency * 0.2;
      A[i] += production;
      H[i] -= production * 0.5;
    });

    const dA = new Array(n).fill(0);
    edges.forEach(edge => {
      const i = edge.from;
      const j = edge.to;
      const flux = 0.04 * edge.weight * (A[j] - A[i]);
      dA[i] += flux;
      dA[j] -= flux;
    });

    for (let i = 0; i < n; i++) {
      A[i] = Math.max(0, A[i] + dA[i]);
    }

    sinks.forEach(i => {
      const take = Math.min(A[i], 0.6);
      A[i] -= take;
      delivered += take;
    });
  }

  let fitness = delivered * 2;

  const perimeter = nodes.reduce((sum, node, i) => {
    const next = nodes[(i + 1) % n];
    return sum + Math.hypot(node.x - next.x, node.y - next.y);
  }, 0);

  fitness -= perimeter * 0.008;
  fitness -= leaked * 0.08;

  const foldComplexity = genome.folds.reduce((sum, fold) => sum + Math.abs(fold.amp), 0);
  fitness += foldComplexity * 2.5;

  const chordCount = genome.edges.length;
  fitness += Math.min(chordCount, n * 0.5) * 0.12;

  if (useQuantum && coherenceCount > 0) {
    const meanQ = coherenceSum / coherenceCount;
    fitness -= Math.pow(meanQ, 2.2) * 4;

    const qVariance = q.reduce((sum, qi) => sum + (qi - meanQ) ** 2, 0) / n;
    if (qVariance < 0.01) {
      fitness -= 1.5;
    }
  }

  return {
    fitness: Math.max(0.1, fitness),
    delivered,
    leaked,
    foldComplexity,
    coherence: coherenceCount > 0 ? coherenceSum / coherenceCount : 0,
    nodeCount: n,
    chordCount,
    perimeter,
  };
}

function mutate(genome, rate = 0.3) {
  const g = JSON.parse(JSON.stringify(genome));

  if (Math.random() < 0.08 && g.nodeCount < NODE_MAX) {
    g.nodeCount += 1;
    g.nodes.push(createRandomNode());
  } else if (Math.random() < 0.06 && g.nodeCount > NODE_MIN) {
    g.nodeCount -= 1;
    g.nodes = g.nodes.slice(0, g.nodeCount);
    g.edges = g.edges.filter(edge => edge.from < g.nodeCount && edge.to < g.nodeCount);
  }

  if (g.nodes.length > g.nodeCount) {
    g.nodes = g.nodes.slice(0, g.nodeCount);
  }
  while (g.nodes.length < g.nodeCount) {
    g.nodes.push(createRandomNode());
  }

  if (Math.random() < rate) {
    g.radiusX = clamp(g.radiusX + (Math.random() - 0.5) * 0.1, 0.3, 0.9);
  }
  if (Math.random() < rate) {
    g.radiusY = clamp(g.radiusY + (Math.random() - 0.5) * 0.1, 0.3, 0.9);
  }
  if (Math.random() < rate) {
    g.pocketAmp = clamp(g.pocketAmp + (Math.random() - 0.5) * 0.06, 0.02, 0.35);
  }
  if (Math.random() < rate) {
    g.pocketFreq = clamp(g.pocketFreq + (Math.random() - 0.5) * 0.6, 0.8, 6);
  }
  if (Math.random() < rate) {
    g.pocketPhase += (Math.random() - 0.5) * 0.6;
  }
  if (Math.random() < rate) {
    g.angleJitter = clamp(g.angleJitter + (Math.random() - 0.5) * 0.05, 0, 0.35);
  }
  if (Math.random() < rate) {
    g.angleJitterFreq = clamp(g.angleJitterFreq + (Math.random() - 0.5) * 0.5, 0.8, 4);
  }
  if (Math.random() < rate) {
    g.angleJitterPhase += (Math.random() - 0.5) * 0.6;
  }

  g.folds.forEach(fold => {
    if (Math.random() < rate) {
      fold.freq = clamp(fold.freq + (Math.random() - 0.5) * 1, 0.4, 8);
    }
    if (Math.random() < rate) {
      fold.amp = clamp(fold.amp + (Math.random() - 0.5) * 0.06, -0.2, 0.25);
    }
    if (Math.random() < rate) {
      fold.phase += (Math.random() - 0.5) * 0.6;
    }
  });

  if (Math.random() < rate) {
    g.porosity = clamp(g.porosity + (Math.random() - 0.5) * 0.1, 0.15, 0.9);
  }
  if (Math.random() < rate) {
    g.resonanceThreshold = clamp(g.resonanceThreshold + (Math.random() - 0.5) * 0.1, 0.2, 0.7);
  }
  if (Math.random() < rate) {
    g.couplingStrength = clamp(g.couplingStrength + (Math.random() - 0.5) * 0.1, 0.15, 0.85);
  }
  if (Math.random() < rate) {
    g.alignmentBias = clamp(g.alignmentBias + (Math.random() - 0.5) * 0.1, 0.1, 0.9);
  }
  if (Math.random() < rate) {
    g.alignmentVariance = clamp(g.alignmentVariance + (Math.random() - 0.5) * 0.08, 0.05, 0.5);
  }
  if (Math.random() < rate) {
    g.edgeWeight = clamp(g.edgeWeight + (Math.random() - 0.5) * 0.15, 0.2, 1);
  }

  g.nodes.forEach(node => {
    if (Math.random() < rate) {
      node.sBias = clamp(node.sBias + (Math.random() - 0.5) * 0.2, 0, 1);
    }
    if (Math.random() < rate) {
      node.leak = clamp(node.leak + (Math.random() - 0.5) * 0.03, 0.005, 0.12);
    }
    if (Math.random() < 0.05) {
      node.type = randomType();
    }
  });

  g.edges.forEach(edge => {
    if (Math.random() < rate) {
      edge.weight = clamp(edge.weight + (Math.random() - 0.5) * 0.2, 0.1, 1);
    }
    if (Math.random() < rate) {
      edge.curvature = clamp(edge.curvature + (Math.random() - 0.5) * 0.4, -1.2, 1.2);
    }
    if (Math.random() < 0.08) {
      const next = createRandomEdge(g.nodeCount);
      edge.from = next.from;
      edge.to = next.to;
      edge.weight = next.weight;
      edge.curvature = next.curvature;
    }
  });

  if (Math.random() < 0.18) {
    g.edges.push(createRandomEdge(g.nodeCount));
  }
  if (Math.random() < 0.12 && g.edges.length > minExtraEdgesFor(g.nodeCount)) {
    g.edges.splice(randInt(0, g.edges.length - 1), 1);
  }

  g.edges = normalizeExtraEdges(g.edges, g.nodeCount);

  return g;
}

function crossover(g1, g2) {
  const child = JSON.parse(JSON.stringify(Math.random() < 0.5 ? g1 : g2));
  child.nodeCount = Math.random() < 0.5 ? g1.nodeCount : g2.nodeCount;

  child.nodes = [];
  for (let i = 0; i < child.nodeCount; i++) {
    const n1 = g1.nodes[i];
    const n2 = g2.nodes[i];
    if (n1 && n2) {
      child.nodes.push(Math.random() < 0.5 ? { ...n1 } : { ...n2 });
    } else if (n1) {
      child.nodes.push({ ...n1 });
    } else if (n2) {
      child.nodes.push({ ...n2 });
    } else {
      child.nodes.push(createRandomNode());
    }
  }

  const edgePool = [];
  const used = new Set();
  g1.edges.forEach(edge => {
    if (Math.random() < 0.5) {
      addEdgeUnique(edgePool, edge, child.nodeCount, used);
    }
  });
  g2.edges.forEach(edge => {
    if (Math.random() < 0.5) {
      addEdgeUnique(edgePool, edge, child.nodeCount, used);
    }
  });
  child.edges = normalizeExtraEdges(edgePool, child.nodeCount);

  if (Math.random() < 0.5) child.radiusX = g2.radiusX;
  if (Math.random() < 0.5) child.radiusY = g2.radiusY;
  if (Math.random() < 0.5) child.pocketAmp = g2.pocketAmp;
  if (Math.random() < 0.5) child.pocketFreq = g2.pocketFreq;
  if (Math.random() < 0.5) child.pocketPhase = g2.pocketPhase;
  if (Math.random() < 0.5) child.angleJitter = g2.angleJitter;
  if (Math.random() < 0.5) child.angleJitterFreq = g2.angleJitterFreq;
  if (Math.random() < 0.5) child.angleJitterPhase = g2.angleJitterPhase;
  if (Math.random() < 0.5) child.thickness = g2.thickness;
  if (Math.random() < 0.5) child.porosity = g2.porosity;
  if (Math.random() < 0.5) child.resonanceThreshold = g2.resonanceThreshold;
  if (Math.random() < 0.5) child.couplingStrength = g2.couplingStrength;
  if (Math.random() < 0.5) child.alignmentBias = g2.alignmentBias;
  if (Math.random() < 0.5) child.alignmentVariance = g2.alignmentVariance;
  if (Math.random() < 0.5) child.edgeWeight = g2.edgeWeight;

  child.folds = g1.folds.map((fold, i) =>
    Math.random() < 0.5 && g2.folds[i] ? { ...g2.folds[i] } : { ...fold }
  );

  return child;
}

const MitoSwimbots = () => {
  const [running, setRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [classicalPop, setClassicalPop] = useState([]);
  const [quantumPop, setQuantumPop] = useState([]);
  const [history, setHistory] = useState({ classical: [], quantum: [] });
  const stateRef = useRef(null);
  const timerRef = useRef(null);

  const initialize = () => {
    const popSize = 16;
    const classical = Array(popSize).fill(null).map(() => {
      const genome = createGenome();
      return { genome, ...simulateFitness(genome, false) };
    });
    const quantum = Array(popSize).fill(null).map(() => {
      const genome = createGenome();
      return { genome, ...simulateFitness(genome, true) };
    });

    classical.sort((a, b) => b.fitness - a.fitness);
    quantum.sort((a, b) => b.fitness - a.fitness);

    stateRef.current = {
      classicalGenomes: classical.map(c => c.genome),
      quantumGenomes: quantum.map(q => q.genome),
      gen: 0,
    };

    setClassicalPop(classical);
    setQuantumPop(quantum);
    setGeneration(0);
    setHistory({ classical: [classical[0].fitness], quantum: [quantum[0].fitness] });
  };

  const evolveStep = () => {
    if (!stateRef.current) return;

    const state = stateRef.current;

    const classicalEval = state.classicalGenomes.map(genome => ({
      genome,
      ...simulateFitness(genome, false),
    }));
    classicalEval.sort((a, b) => b.fitness - a.fitness);

    const quantumEval = state.quantumGenomes.map(genome => ({
      genome,
      ...simulateFitness(genome, true),
    }));
    quantumEval.sort((a, b) => b.fitness - a.fitness);

    const classicalNext = [];
    classicalNext.push(classicalEval[0].genome);
    classicalNext.push(classicalEval[1].genome);

    while (classicalNext.length < state.classicalGenomes.length) {
      const p1 = classicalEval[Math.floor(Math.random() * 8)].genome;
      const p2 = classicalEval[Math.floor(Math.random() * 8)].genome;
      classicalNext.push(mutate(crossover(p1, p2)));
    }

    const quantumNext = [];
    quantumNext.push(quantumEval[0].genome);
    quantumNext.push(quantumEval[1].genome);

    while (quantumNext.length < state.quantumGenomes.length) {
      const p1 = quantumEval[Math.floor(Math.random() * 8)].genome;
      const p2 = quantumEval[Math.floor(Math.random() * 8)].genome;
      quantumNext.push(mutate(crossover(p1, p2)));
    }

    state.classicalGenomes = classicalNext;
    state.quantumGenomes = quantumNext;
    state.gen += 1;

    setClassicalPop(classicalEval.slice(0, 9));
    setQuantumPop(quantumEval.slice(0, 9));
    setGeneration(state.gen);
    setHistory(prev => ({
      classical: [...prev.classical.slice(-50), classicalEval[0].fitness],
      quantum: [...prev.quantum.slice(-50), quantumEval[0].fitness],
    }));
  };

  useEffect(() => {
    if (running) {
      if (!stateRef.current) {
        initialize();
      }
      timerRef.current = setInterval(evolveStep, 400);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const reset = () => {
    setRunning(false);
    stateRef.current = null;
    setClassicalPop([]);
    setQuantumPop([]);
    setGeneration(0);
    setHistory({ classical: [], quantum: [] });
  };

  const drawOrganism = (ctx, org, x, y, size, isQuantum, isBest) => {
    const graph = buildMembraneGraph(org.genome, size * 0.42);
    const { nodes, edges } = graph;

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = isBest
      ? (isQuantum ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)')
      : 'rgba(30, 41, 59, 0.4)';
    ctx.fillRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4);

    ctx.strokeStyle = isBest
      ? (isQuantum ? '#8b5cf6' : '#3b82f6')
      : '#334155';
    ctx.lineWidth = isBest ? 2 : 1;
    ctx.strokeRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4);

    edges.filter(edge => !edge.ring).forEach(edge => {
      const from = nodes[edge.from];
      const to = nodes[edge.to];
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const dx = to.y - from.y;
      const dy = -(to.x - from.x);
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const bend = edge.curvature * size * 0.12;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(midX + nx * bend, midY + ny * bend, to.x, to.y);
      ctx.strokeStyle = isQuantum ? 'rgba(167, 139, 250, 0.18)' : 'rgba(96, 165, 250, 0.18)';
      ctx.lineWidth = 0.6 + edge.weight * 1.2;
      ctx.stroke();
    });

    ctx.beginPath();
    nodes.forEach((node, i) => {
      if (i === 0) ctx.moveTo(node.x, node.y);
      else ctx.lineTo(node.x, node.y);
    });
    ctx.closePath();

    ctx.strokeStyle = isQuantum ? 'rgba(167, 139, 250, 0.25)' : 'rgba(96, 165, 250, 0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.strokeStyle = isQuantum ? '#a78bfa' : '#60a5fa';
    ctx.lineWidth = 1.5 + org.genome.thickness * 20;
    ctx.stroke();

    nodes.forEach((node, i) => {
      if (i % 2 !== 0) return;
      let fill = `rgba(148, 163, 184, ${0.25 + node.s * 0.4})`;
      if (node.type === 'etc') fill = 'rgba(34, 211, 238, 0.8)';
      if (node.type === 'synthase') fill = 'rgba(52, 211, 153, 0.85)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 1.3 + node.s * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    });

    if (isQuantum) {
      nodes.forEach((node, i) => {
        if (i % 4 === 0 && node.s > 0.6) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 1.8 + node.s * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 146, 60, ${node.s * 0.6})`;
          ctx.fill();
        }
      });
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(org.fitness.toFixed(1), 0, size / 2 - 6);

    ctx.restore();
  };

  const PopulationGrid = ({ population, isQuantum, title }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || population.length === 0) return;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cellSize = 75;
      const cols = 3;

      population.slice(0, 9).forEach((org, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = col * cellSize + cellSize / 2 + 8;
        const y = row * cellSize + cellSize / 2 + 8;
        drawOrganism(ctx, org, x, y, cellSize - 6, isQuantum, i === 0);
      });
    }, [population, isQuantum]);

    const best = population[0];
    const nodeCount = best?.genome?.nodeCount ?? best?.nodeCount ?? 0;
    const chordCount = best?.genome?.edges?.length ?? best?.chordCount ?? 0;

    return (
      <div className="flex-1">
        <div className={`text-sm font-medium mb-2 ${isQuantum ? 'text-purple-400' : 'text-blue-400'}`}>
          {title}
        </div>
        <canvas ref={canvasRef} width={240} height={240} className="rounded-lg" />
        {best && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-900/50 p-2 rounded">
              <div className="text-gray-500">Best Fitness</div>
              <div className={`font-mono ${isQuantum ? 'text-purple-400' : 'text-blue-400'}`}>
                {best.fitness.toFixed(1)}
              </div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded">
              <div className="text-gray-500">Nodes</div>
              <div className="text-gray-300 font-mono">{nodeCount}</div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded">
              <div className="text-gray-500">Chords</div>
              <div className="text-gray-300 font-mono">{chordCount}</div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded">
              <div className="text-gray-500">ATP</div>
              <div className="text-green-400 font-mono">{best.delivered.toFixed(1)}</div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded">
              <div className="text-gray-500">Folds</div>
              <div className="text-yellow-400 font-mono">{best.foldComplexity.toFixed(2)}</div>
            </div>
            {isQuantum && (
              <div className="bg-gray-900/50 p-2 rounded col-span-2">
                <div className="text-gray-500">Coherence</div>
                <div className="text-orange-400 font-mono">{(best.coherence * 100).toFixed(0)}%</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const FitnessChart = () => {
    if (history.classical.length < 2) return null;

    const all = [...history.classical, ...history.quantum];
    const maxFit = Math.max(...all, 10);
    const minFit = Math.min(...all, 0);
    const range = maxFit - minFit || 1;

    const toY = (f) => 75 - ((f - minFit) / range) * 60;

    const classicalPath = history.classical.map((f, i) =>
      `${20 + (i / Math.max(history.classical.length - 1, 1)) * 260},${toY(f)}`
    ).join(' L ');

    const quantumPath = history.quantum.map((f, i) =>
      `${20 + (i / Math.max(history.quantum.length - 1, 1)) * 260},${toY(f)}`
    ).join(' L ');

    return (
      <svg viewBox="0 0 300 90" className="w-full h-24">
        <line x1="20" y1="15" x2="280" y2="15" stroke="#1e293b" />
        <line x1="20" y1="45" x2="280" y2="45" stroke="#1e293b" />
        <line x1="20" y1="75" x2="280" y2="75" stroke="#1e293b" />

        <text x="5" y="18" fill="#64748b" fontSize="8">{maxFit.toFixed(0)}</text>
        <text x="5" y="78" fill="#64748b" fontSize="8">{minFit.toFixed(0)}</text>

        {history.classical.length > 1 && (
          <path d={`M ${classicalPath}`} fill="none" stroke="#3b82f6" strokeWidth="2" />
        )}
        {history.quantum.length > 1 && (
          <path d={`M ${quantumPath}`} fill="none" stroke="#8b5cf6" strokeWidth="2" />
        )}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-xl font-light text-gray-200">Mitochondrial Membrane Evolution</h1>
          <p className="text-sm text-gray-500">Graph membrane topology with closed-curve boundaries</p>
        </div>

        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={() => setRunning(!running)}
            className={`px-5 py-2 rounded-lg font-medium transition-colors ${
              running
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {running ? '⏸ Pause' : '▶ Evolve'}
          </button>
          <button
            onClick={reset}
            className="px-5 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700"
          >
            ↺ Reset
          </button>
          <div className="px-4 py-2 bg-gray-900 rounded-lg border border-gray-800">
            <span className="text-gray-500 text-sm">Gen </span>
            <span className="text-xl font-mono text-gray-200">{generation}</span>
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <PopulationGrid
            population={classicalPop}
            isQuantum={false}
            title="Classical (No Quantum)"
          />
          <PopulationGrid
            population={quantumPop}
            isQuantum={true}
            title="Quantum Resonance"
          />
        </div>

        <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-800 mb-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-400">Best Fitness Over Generations</span>
            <div className="flex gap-4">
              <span className="text-blue-400">● Classical</span>
              <span className="text-purple-400">● Quantum</span>
            </div>
          </div>
          <FitnessChart />
        </div>

        <div className="flex justify-center gap-6 text-xs text-gray-500 mb-4">
          <span>Closed curve boundary with internal coupling chords</span>
          <span><span className="text-cyan-400">●</span> ETC source <span className="text-emerald-400">●</span> Synthase</span>
          <span><span className="text-orange-400">●</span> Alignment hotspot</span>
        </div>

        <div className="p-3 bg-gray-900/30 rounded-lg border border-gray-800 text-sm text-gray-400">
          <strong className="text-gray-300">Watch for:</strong> Do quantum runs favor more modular chord
          structures, deeper pockets, or sharper alignment hot spots compared to classical diffusion?
        </div>
      </div>
    </div>
  );
};

export default MitoSwimbots;
