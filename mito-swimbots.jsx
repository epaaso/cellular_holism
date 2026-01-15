import React, { useState, useEffect, useRef, useCallback } from 'react';

// Swimbots-style evolutionary gallery for membrane geometries
// Comparing Classical vs Quantum-assisted ATP exchange
// Shows diverse shapes: circles, spirals, complex folds

const MitoSwimbots = () => {
  const [running, setRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [classicalPop, setClassicalPop] = useState([]);
  const [quantumPop, setQuantumPop] = useState([]);
  const [classicalHistory, setClassicalHistory] = useState([]);
  const [quantumHistory, setQuantumHistory] = useState([]);
  const [selectedOrganism, setSelectedOrganism] = useState(null);
  const animationRef = useRef(null);
  const stateRef = useRef(null);

  // Rich genome with multiple shape primitives
  const createGenome = () => {
    // Shape type determines base morphology
    const shapeType = Math.random();
    
    return {
      // Base shape parameters
      shapeType, // 0-0.25: circle, 0.25-0.5: ellipse, 0.5-0.75: spiral, 0.75-1: wavy tube
      
      // For circular/elliptical
      radiusX: 0.3 + Math.random() * 0.4,
      radiusY: 0.3 + Math.random() * 0.4,
      
      // For spiral
      spiralTurns: 0.5 + Math.random() * 2.5,
      spiralTightness: 0.1 + Math.random() * 0.3,
      
      // Fourier fold modulations (cristae-like)
      folds: Array(8).fill(0).map(() => ({
        freq: Math.random() * 6 + 0.5,
        amp: Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
      })),
      
      // Membrane properties
      thickness: 0.02 + Math.random() * 0.04,
      porosity: 0.2 + Math.random() * 0.5,
      
      // Quantum parameters
      resonanceThreshold: 0.3 + Math.random() * 0.4,
      couplingStrength: 0.2 + Math.random() * 0.5,
      
      // Alignment propensity distribution
      alignmentBias: Math.random(),
      alignmentVariance: 0.1 + Math.random() * 0.3,
    };
  };

  // Generate membrane shape from genome - returns array of {x, y, s} where s is alignment propensity
  const generateShape = (genome, scale = 50) => {
    const points = [];
    const numPoints = 120;
    
    for (let i = 0; i < numPoints; i++) {
      const t = i / numPoints;
      const angle = t * Math.PI * 2;
      
      let x, y;
      
      if (genome.shapeType < 0.25) {
        // Circle with folds
        const r = genome.radiusX * scale;
        x = Math.cos(angle) * r;
        y = Math.sin(angle) * r;
      } else if (genome.shapeType < 0.5) {
        // Ellipse with folds
        x = Math.cos(angle) * genome.radiusX * scale;
        y = Math.sin(angle) * genome.radiusY * scale;
      } else if (genome.shapeType < 0.75) {
        // Spiral
        const progress = t * genome.spiralTurns;
        const r = (0.2 + progress * genome.spiralTightness) * scale;
        x = Math.cos(angle * genome.spiralTurns) * r;
        y = Math.sin(angle * genome.spiralTurns) * r;
      } else {
        // Wavy tube (open curve)
        x = (t - 0.5) * scale * 1.8;
        y = Math.sin(t * Math.PI * 2) * genome.radiusY * scale * 0.5;
      }
      
      // Apply fold modulations (cristae)
      let foldOffset = 0;
      genome.folds.forEach(fold => {
        foldOffset += fold.amp * Math.sin(fold.freq * angle + fold.phase);
      });
      
      // Apply fold perpendicular to curve
      const normalAngle = angle + Math.PI / 2;
      x += Math.cos(normalAngle) * foldOffset * scale;
      y += Math.sin(normalAngle) * foldOffset * scale;
      
      // Alignment propensity varies along membrane
      const s = genome.alignmentBias + 
        Math.sin(t * Math.PI * 4 + genome.alignmentVariance * 10) * genome.alignmentVariance;
      
      points.push({ x, y, s: Math.max(0, Math.min(1, s)) });
    }
    
    return points;
  };

  // Simulate ATP exchange for a membrane
  const simulateFitness = (genome, useQuantum, steps = 150) => {
    const shape = generateShape(genome, 40);
    const n = shape.length;
    
    // State: H (gradient), A (ATP), q (coherence)
    const H = new Array(n).fill(0);
    const A = new Array(n).fill(0);
    const q = new Array(n).fill(0);
    
    // Place sources and sinks
    const sources = [0, Math.floor(n/4), Math.floor(n/2)];
    const synthases = [Math.floor(n/8), Math.floor(3*n/8), Math.floor(5*n/8), Math.floor(7*n/8)];
    const sinks = [Math.floor(n/3), Math.floor(2*n/3)];
    
    let delivered = 0;
    let leaked = 0;
    let coherenceSum = 0;
    let coherenceCount = 0;
    
    for (let step = 0; step < steps; step++) {
      // Inject gradient at sources
      sources.forEach(i => { H[i] += 0.8; });
      
      // Compute coherence (quantum mode)
      if (useQuantum) {
        for (let i = 0; i < n; i++) {
          const neighbors = [(i - 1 + n) % n, (i + 1) % n];
          let alignmentDensity = 0;
          neighbors.forEach(j => {
            alignmentDensity += shape[i].s * shape[j].s;
          });
          alignmentDensity /= neighbors.length;
          
          // Sigmoid activation
          const C = alignmentDensity - genome.resonanceThreshold;
          q[i] = 1 / (1 + Math.exp(-8 * C));
          
          coherenceSum += q[i];
          coherenceCount++;
        }
      }
      
      // Transport (diffusion with coherence boost)
      const dH = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        let conductance = genome.porosity * 0.5;
        
        if (useQuantum) {
          conductance *= (1 + genome.couplingStrength * (q[i] + q[j]) / 2);
        }
        
        const flux = conductance * (H[j] - H[i]) * 0.1;
        dH[i] += flux;
        dH[j] -= flux;
      }
      
      for (let i = 0; i < n; i++) {
        H[i] = Math.max(0, H[i] + dH[i]);
      }
      
      // Leakage
      for (let i = 0; i < n; i++) {
        const leakRate = 0.02 + (1 - shape[i].s) * 0.03;
        const loss = H[i] * leakRate;
        H[i] -= loss;
        leaked += loss;
      }
      
      // ATP synthesis at synthase sites
      synthases.forEach(i => {
        let efficiency = 0.3;
        if (useQuantum && q[i] > 0.5) {
          efficiency *= (1 + genome.couplingStrength * 0.8);
        }
        const production = H[i] * efficiency * 0.2;
        A[i] += production;
        H[i] -= production * 0.5;
      });
      
      // ATP delivery at sinks
      sinks.forEach(i => {
        const take = Math.min(A[i], 0.5);
        A[i] -= take;
        delivered += take;
      });
    }
    
    // Fitness calculation
    let fitness = delivered * 2;
    
    // Cost for membrane complexity (surface area proxy)
    const perimeter = shape.reduce((sum, p, i) => {
      const next = shape[(i + 1) % n];
      return sum + Math.sqrt((p.x - next.x) ** 2 + (p.y - next.y) ** 2);
    }, 0);
    fitness -= perimeter * 0.01;
    
    // Cost for leakage
    fitness -= leaked * 0.1;
    
    // Quantum penalties (avoid bad quantum effects)
    if (useQuantum && coherenceCount > 0) {
      const meanQ = coherenceSum / coherenceCount;
      
      // Over-coherence penalty
      fitness -= Math.pow(meanQ, 2.2) * 5;
      
      // Uniformity penalty (want structured coherence, not global)
      const qVariance = q.reduce((sum, qi) => sum + (qi - meanQ) ** 2, 0) / n;
      if (qVariance < 0.01) {
        fitness -= 2; // Penalize too-uniform coherence
      }
    }
    
    // Fold complexity bonus (reward cristae-like structure)
    const foldComplexity = genome.folds.reduce((sum, f) => sum + f.amp, 0);
    fitness += foldComplexity * 3;
    
    return {
      fitness: Math.max(0, fitness),
      delivered,
      leaked,
      perimeter,
      coherence: coherenceCount > 0 ? coherenceSum / coherenceCount : 0,
      foldComplexity,
    };
  };

  // Mutate genome
  const mutate = (genome, rate = 0.3) => {
    const g = JSON.parse(JSON.stringify(genome));
    
    // Occasionally shift shape type
    if (Math.random() < 0.05) {
      g.shapeType = Math.random();
    }
    
    if (Math.random() < rate) {
      g.radiusX += (Math.random() - 0.5) * 0.1;
      g.radiusX = Math.max(0.2, Math.min(0.8, g.radiusX));
    }
    
    if (Math.random() < rate) {
      g.radiusY += (Math.random() - 0.5) * 0.1;
      g.radiusY = Math.max(0.2, Math.min(0.8, g.radiusY));
    }
    
    if (Math.random() < rate) {
      g.spiralTurns += (Math.random() - 0.5) * 0.5;
      g.spiralTurns = Math.max(0.3, Math.min(4, g.spiralTurns));
    }
    
    // Mutate folds
    g.folds.forEach(fold => {
      if (Math.random() < rate) {
        fold.freq += (Math.random() - 0.5) * 1;
        fold.freq = Math.max(0.3, Math.min(10, fold.freq));
      }
      if (Math.random() < rate) {
        fold.amp += (Math.random() - 0.5) * 0.05;
        fold.amp = Math.max(0, Math.min(0.3, fold.amp));
      }
      if (Math.random() < rate) {
        fold.phase += (Math.random() - 0.5) * 0.5;
      }
    });
    
    if (Math.random() < rate) {
      g.porosity += (Math.random() - 0.5) * 0.1;
      g.porosity = Math.max(0.1, Math.min(0.8, g.porosity));
    }
    
    if (Math.random() < rate) {
      g.resonanceThreshold += (Math.random() - 0.5) * 0.1;
      g.resonanceThreshold = Math.max(0.2, Math.min(0.7, g.resonanceThreshold));
    }
    
    if (Math.random() < rate) {
      g.couplingStrength += (Math.random() - 0.5) * 0.1;
      g.couplingStrength = Math.max(0.1, Math.min(0.8, g.couplingStrength));
    }
    
    if (Math.random() < rate) {
      g.alignmentBias += (Math.random() - 0.5) * 0.1;
      g.alignmentBias = Math.max(0, Math.min(1, g.alignmentBias));
    }
    
    return g;
  };

  // Crossover
  const crossover = (g1, g2) => {
    const child = JSON.parse(JSON.stringify(g1));
    
    if (Math.random() < 0.5) child.shapeType = g2.shapeType;
    if (Math.random() < 0.5) child.radiusX = g2.radiusX;
    if (Math.random() < 0.5) child.radiusY = g2.radiusY;
    if (Math.random() < 0.5) child.spiralTurns = g2.spiralTurns;
    if (Math.random() < 0.5) child.porosity = g2.porosity;
    if (Math.random() < 0.5) child.resonanceThreshold = g2.resonanceThreshold;
    if (Math.random() < 0.5) child.couplingStrength = g2.couplingStrength;
    
    // Mix folds
    for (let i = 0; i < child.folds.length; i++) {
      if (Math.random() < 0.5 && g2.folds[i]) {
        child.folds[i] = { ...g2.folds[i] };
      }
    }
    
    return child;
  };

  // Evolve one generation
  const evolveGeneration = (population, useQuantum) => {
    // Evaluate fitness
    const evaluated = population.map(genome => ({
      genome,
      ...simulateFitness(genome, useQuantum),
    }));
    
    // Sort by fitness
    evaluated.sort((a, b) => b.fitness - a.fitness);
    
    // Selection
    const elite = evaluated.slice(0, 4);
    const selected = evaluated.slice(0, 12);
    
    // Create next generation
    const nextPop = elite.map(e => e.genome);
    
    while (nextPop.length < population.length) {
      const p1 = selected[Math.floor(Math.random() * selected.length)].genome;
      const p2 = selected[Math.floor(Math.random() * selected.length)].genome;
      nextPop.push(mutate(crossover(p1, p2)));
    }
    
    return { population: nextPop, evaluated };
  };

  // Draw a single organism
  const drawOrganism = (ctx, genome, stats, x, y, size, highlight = false, useQuantum = false) => {
    const shape = generateShape(genome, size * 0.4);
    
    ctx.save();
    ctx.translate(x, y);
    
    // Background
    ctx.fillStyle = highlight ? 'rgba(139, 92, 246, 0.1)' : 'rgba(30, 41, 59, 0.5)';
    ctx.fillRect(-size/2, -size/2, size, size);
    
    // Border
    ctx.strokeStyle = highlight ? '#8b5cf6' : '#334155';
    ctx.lineWidth = highlight ? 2 : 1;
    ctx.strokeRect(-size/2, -size/2, size, size);
    
    // Draw membrane
    ctx.beginPath();
    shape.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    
    // Close path for circular shapes
    if (genome.shapeType < 0.75) {
      ctx.closePath();
    }
    
    // Glow effect
    ctx.strokeStyle = useQuantum ? 'rgba(167, 139, 250, 0.3)' : 'rgba(96, 165, 250, 0.3)';
    ctx.lineWidth = 6;
    ctx.stroke();
    
    // Main line
    ctx.strokeStyle = useQuantum ? '#a78bfa' : '#60a5fa';
    ctx.lineWidth = 2 + genome.thickness * 30;
    ctx.stroke();
    
    // Alignment hotspots (colored dots where s is high)
    shape.forEach((p, i) => {
      if (i % 6 === 0 && p.s > 0.6) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + p.s * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 146, 60, ${p.s * 0.8})`;
        ctx.fill();
      }
    });
    
    // Fitness label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${stats.fitness.toFixed(1)}`, 0, size/2 - 5);
    
    ctx.restore();
  };

  // Main simulation loop
  useEffect(() => {
    if (!running) return;
    
    if (!stateRef.current) {
      // Initialize populations
      const popSize = 20;
      stateRef.current = {
        classicalPop: Array(popSize).fill(null).map(() => createGenome()),
        quantumPop: Array(popSize).fill(null).map(() => createGenome()),
        gen: 0,
        classicalHistory: [],
        quantumHistory: [],
      };
    }
    
    const tick = () => {
      const state = stateRef.current;
      
      // Evolve both populations
      const classicalResult = evolveGeneration(state.classicalPop, false);
      const quantumResult = evolveGeneration(state.quantumPop, true);
      
      state.classicalPop = classicalResult.population;
      state.quantumPop = quantumResult.population;
      state.gen++;
      
      // Store top 6 from each for display
      state.classicalHistory.push(classicalResult.evaluated.slice(0, 6));
      state.quantumHistory.push(quantumResult.evaluated.slice(0, 6));
      
      // Keep only last 10 generations
      if (state.classicalHistory.length > 10) {
        state.classicalHistory.shift();
        state.quantumHistory.shift();
      }
      
      setGeneration(state.gen);
      setClassicalPop(classicalResult.evaluated.slice(0, 6));
      setQuantumPop(quantumResult.evaluated.slice(0, 6));
      setClassicalHistory([...state.classicalHistory]);
      setQuantumHistory([...state.quantumHistory]);
      
      if (state.gen < 100) {
        animationRef.current = setTimeout(tick, 300);
      }
    };
    
    tick();
    
    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [running]);

  // Render organism grid
  const renderGrid = (population, title, useQuantum, history) => {
    const canvasRef = useRef(null);
    
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || population.length === 0) return;
      
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      
      // Draw current generation (top row, larger)
      const cellSize = 90;
      const cols = 6;
      
      population.forEach((org, i) => {
        const x = (i % cols) * cellSize + cellSize / 2 + 10;
        const y = cellSize / 2 + 10;
        drawOrganism(ctx, org.genome, org, x, y, cellSize - 10, i === 0, useQuantum);
      });
      
      // Draw history (smaller, showing evolution)
      if (history.length > 1) {
        const histCellSize = 50;
        const startY = cellSize + 30;
        
        ctx.fillStyle = '#64748b';
        ctx.font = '10px system-ui';
        ctx.fillText('Evolution History:', 10, startY - 5);
        
        history.slice(-8).forEach((gen, genIdx) => {
          // Just show best from each generation
          const best = gen[0];
          if (best) {
            const x = genIdx * (histCellSize + 5) + histCellSize / 2 + 10;
            const y = startY + histCellSize / 2 + 5;
            
            // Fade older generations
            ctx.globalAlpha = 0.4 + (genIdx / 8) * 0.6;
            drawOrganism(ctx, best.genome, best, x, y, histCellSize - 5, false, useQuantum);
            ctx.globalAlpha = 1;
          }
        });
      }
      
    }, [population, history, useQuantum]);
    
    return (
      <div className="flex-1">
        <div className={`text-sm font-medium mb-2 ${useQuantum ? 'text-purple-400' : 'text-blue-400'}`}>
          {title}
        </div>
        <canvas
          ref={canvasRef}
          width={560}
          height={220}
          className="rounded-lg"
        />
        {population[0] && (
          <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
            <div className="bg-gray-900/50 p-2 rounded">
              <div className="text-gray-500">Best Fitness</div>
              <div className={`font-mono ${useQuantum ? 'text-purple-400' : 'text-blue-400'}`}>
                {population[0].fitness.toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded">
              <div className="text-gray-500">ATP Delivered</div>
              <div className="font-mono text-green-400">{population[0].delivered.toFixed(1)}</div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded">
              <div className="text-gray-500">Fold Complexity</div>
              <div className="font-mono text-yellow-400">{population[0].foldComplexity.toFixed(3)}</div>
            </div>
            {useQuantum && (
              <div className="bg-gray-900/50 p-2 rounded">
                <div className="text-gray-500">Coherence</div>
                <div className="font-mono text-orange-400">{(population[0].coherence * 100).toFixed(0)}%</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const reset = () => {
    setRunning(false);
    stateRef.current = null;
    setGeneration(0);
    setClassicalPop([]);
    setQuantumPop([]);
    setClassicalHistory([]);
    setQuantumHistory([]);
  };

  // Detailed organism view
  const OrganismDetail = ({ organism, useQuantum }) => {
    const canvasRef = useRef(null);
    
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !organism) return;
      
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      
      drawOrganism(ctx, organism.genome, organism, width/2, height/2, 180, true, useQuantum);
    }, [organism, useQuantum]);
    
    if (!organism) return null;
    
    const shapeNames = ['Circle', 'Ellipse', 'Spiral', 'Wavy Tube'];
    const shapeIdx = Math.floor(organism.genome.shapeType * 4);
    
    return (
      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
        <div className="text-sm text-gray-400 mb-2">Selected Organism</div>
        <canvas ref={canvasRef} width={200} height={200} className="rounded mb-3" />
        <div className="text-xs space-y-1">
          <div><span className="text-gray-500">Shape:</span> <span className="text-gray-300">{shapeNames[shapeIdx]}</span></div>
          <div><span className="text-gray-500">Folds:</span> <span className="text-gray-300">{organism.genome.folds.filter(f => f.amp > 0.05).length} active</span></div>
          <div><span className="text-gray-500">Porosity:</span> <span className="text-gray-300">{(organism.genome.porosity * 100).toFixed(0)}%</span></div>
          {useQuantum && (
            <>
              <div><span className="text-gray-500">Resonance θ:</span> <span className="text-purple-300">{organism.genome.resonanceThreshold.toFixed(2)}</span></div>
              <div><span className="text-gray-500">Coupling:</span> <span className="text-purple-300">{organism.genome.couplingStrength.toFixed(2)}</span></div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Fitness chart
  const renderFitnessChart = () => {
    if (classicalHistory.length < 2) return null;
    
    const classicalBest = classicalHistory.map(gen => gen[0]?.fitness || 0);
    const quantumBest = quantumHistory.map(gen => gen[0]?.fitness || 0);
    const maxFit = Math.max(...classicalBest, ...quantumBest, 20);
    
    return (
      <svg viewBox="0 0 200 80" className="w-full h-20">
        {/* Grid */}
        <line x1="20" y1="10" x2="190" y2="10" stroke="#1e293b" />
        <line x1="20" y1="40" x2="190" y2="40" stroke="#1e293b" />
        <line x1="20" y1="70" x2="190" y2="70" stroke="#1e293b" />
        
        {/* Classical line */}
        <path
          d={`M ${classicalBest.map((f, i) => `${20 + (i / (classicalBest.length - 1)) * 170},${70 - (f / maxFit) * 60}`).join(' L ')}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />
        
        {/* Quantum line */}
        <path
          d={`M ${quantumBest.map((f, i) => `${20 + (i / (quantumBest.length - 1)) * 170},${70 - (f / maxFit) * 60}`).join(' L ')}`}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
        />
        
        <text x="10" y="15" fill="#64748b" fontSize="8">{maxFit.toFixed(0)}</text>
        <text x="10" y="73" fill="#64748b" fontSize="8">0</text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-light text-gray-200">Mitochondrial Membrane Evolution</h1>
          <p className="text-sm text-gray-500">Swimbots-style Gallery • Classical vs Quantum-Assisted</p>
        </div>
        
        {/* Controls */}
        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={() => setRunning(!running)}
            className={`px-5 py-2 rounded-lg font-medium ${
              running ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {running ? '⏸ Pause' : '▶ Evolve'}
          </button>
          <button onClick={reset} className="px-5 py-2 rounded-lg bg-gray-800 text-gray-300">
            ↺ Reset
          </button>
          <div className="px-4 py-2 bg-gray-900 rounded-lg">
            <span className="text-gray-500 text-sm">Gen</span>
            <span className="ml-2 text-xl font-mono text-gray-300">{generation}</span>
          </div>
        </div>
        
        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Classical */}
          <div className="lg:col-span-1">
            <ClassicalGrid 
              population={classicalPop} 
              history={classicalHistory}
              onSelect={(org) => setSelectedOrganism({ org, quantum: false })}
            />
          </div>
          
          {/* Center: Comparison & Detail */}
          <div className="lg:col-span-1 space-y-4">
            {/* Fitness comparison */}
            <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-800">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400">Fitness Over Generations</span>
                <div className="flex gap-3">
                  <span className="text-blue-400">● Classical</span>
                  <span className="text-purple-400">● Quantum</span>
                </div>
              </div>
              {renderFitnessChart()}
            </div>
            
            {/* Selected organism detail */}
            {selectedOrganism && (
              <OrganismDetail 
                organism={selectedOrganism.org} 
                useQuantum={selectedOrganism.quantum}
              />
            )}
            
            {/* Legend */}
            <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-800 text-xs">
              <div className="text-gray-400 mb-2">Shape Types</div>
              <div className="grid grid-cols-2 gap-1 text-gray-500">
                <div>○ Circle • Ellipse</div>
                <div>◐ Spiral • Wavy Tube</div>
              </div>
              <div className="mt-2 text-gray-500">
                <span className="text-orange-400">●</span> = High alignment (coherence hotspot)
              </div>
            </div>
          </div>
          
          {/* Right: Quantum */}
          <div className="lg:col-span-1">
            <QuantumGrid 
              population={quantumPop}
              history={quantumHistory}
              onSelect={(org) => setSelectedOrganism({ org, quantum: true })}
            />
          </div>
        </div>
        
        {/* Hypothesis */}
        <div className="mt-4 p-3 bg-gray-900/30 rounded-lg border border-gray-800 text-sm text-gray-400">
          <strong className="text-gray-300">Hypothesis:</strong> Quantum-assisted evolution (with coherence 
          boosts + penalties for "bad quantum effects") should evolve more complex, cristae-like membrane 
          geometries. Look for: higher fold complexity, more diverse shapes, and modular alignment patterns 
          in the quantum population vs classical.
        </div>
      </div>
    </div>
  );
};

// Separate component for classical grid
const ClassicalGrid = ({ population, history, onSelect }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || population.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Current generation
    const cellSize = 85;
    population.slice(0, 6).forEach((org, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = col * cellSize + cellSize / 2 + 5;
      const y = row * cellSize + cellSize / 2 + 5;
      
      // Draw organism
      const shape = generateShapeStatic(org.genome, cellSize * 0.35);
      
      ctx.save();
      ctx.translate(x, y);
      
      ctx.fillStyle = i === 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(30, 41, 59, 0.5)';
      ctx.fillRect(-cellSize/2 + 3, -cellSize/2 + 3, cellSize - 6, cellSize - 6);
      
      ctx.strokeStyle = i === 0 ? '#3b82f6' : '#334155';
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.strokeRect(-cellSize/2 + 3, -cellSize/2 + 3, cellSize - 6, cellSize - 6);
      
      ctx.beginPath();
      shape.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (org.genome.shapeType < 0.75) ctx.closePath();
      
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.lineWidth = 5;
      ctx.stroke();
      
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#64748b';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(org.fitness.toFixed(1), 0, cellSize/2 - 8);
      
      ctx.restore();
    });
    
    // History strip
    if (history.length > 1) {
      const histY = 180;
      ctx.fillStyle = '#475569';
      ctx.font = '9px system-ui';
      ctx.fillText('History:', 5, histY);
      
      history.slice(-6).forEach((gen, idx) => {
        const best = gen[0];
        if (best) {
          const hx = 50 + idx * 40;
          const shape = generateShapeStatic(best.genome, 15);
          
          ctx.save();
          ctx.translate(hx, histY + 15);
          ctx.globalAlpha = 0.4 + idx * 0.1;
          
          ctx.beginPath();
          shape.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          if (best.genome.shapeType < 0.75) ctx.closePath();
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          
          ctx.restore();
        }
      });
    }
  }, [population, history]);
  
  return (
    <div>
      <div className="text-sm font-medium mb-2 text-blue-400">Classical (No Quantum)</div>
      <canvas
        ref={canvasRef}
        width={260}
        height={220}
        className="rounded-lg cursor-pointer"
        onClick={() => population[0] && onSelect(population[0])}
      />
      {population[0] && (
        <div className="mt-2 text-xs grid grid-cols-2 gap-2">
          <div className="bg-gray-900/50 p-2 rounded">
            <div className="text-gray-500">Best Fitness</div>
            <div className="text-blue-400 font-mono">{population[0].fitness.toFixed(2)}</div>
          </div>
          <div className="bg-gray-900/50 p-2 rounded">
            <div className="text-gray-500">Fold Complexity</div>
            <div className="text-yellow-400 font-mono">{population[0].foldComplexity.toFixed(3)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Quantum grid
const QuantumGrid = ({ population, history, onSelect }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || population.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const cellSize = 85;
    population.slice(0, 6).forEach((org, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = col * cellSize + cellSize / 2 + 5;
      const y = row * cellSize + cellSize / 2 + 5;
      
      const shape = generateShapeStatic(org.genome, cellSize * 0.35);
      
      ctx.save();
      ctx.translate(x, y);
      
      ctx.fillStyle = i === 0 ? 'rgba(139, 92, 246, 0.1)' : 'rgba(30, 41, 59, 0.5)';
      ctx.fillRect(-cellSize/2 + 3, -cellSize/2 + 3, cellSize - 6, cellSize - 6);
      
      ctx.strokeStyle = i === 0 ? '#8b5cf6' : '#334155';
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.strokeRect(-cellSize/2 + 3, -cellSize/2 + 3, cellSize - 6, cellSize - 6);
      
      ctx.beginPath();
      shape.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (org.genome.shapeType < 0.75) ctx.closePath();
      
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)';
      ctx.lineWidth = 5;
      ctx.stroke();
      
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Alignment hotspots
      shape.forEach((p, idx) => {
        if (idx % 8 === 0 && p.s > 0.55) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2 + p.s * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 146, 60, ${p.s * 0.7})`;
          ctx.fill();
        }
      });
      
      ctx.fillStyle = '#64748b';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(org.fitness.toFixed(1), 0, cellSize/2 - 8);
      
      ctx.restore();
    });
    
    // History
    if (history.length > 1) {
      const histY = 180;
      ctx.fillStyle = '#475569';
      ctx.font = '9px system-ui';
      ctx.fillText('History:', 5, histY);
      
      history.slice(-6).forEach((gen, idx) => {
        const best = gen[0];
        if (best) {
          const hx = 50 + idx * 40;
          const shape = generateShapeStatic(best.genome, 15);
          
          ctx.save();
          ctx.translate(hx, histY + 15);
          ctx.globalAlpha = 0.4 + idx * 0.1;
          
          ctx.beginPath();
          shape.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          if (best.genome.shapeType < 0.75) ctx.closePath();
          ctx.strokeStyle = '#a78bfa';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          
          ctx.restore();
        }
      });
    }
  }, [population, history]);
  
  return (
    <div>
      <div className="text-sm font-medium mb-2 text-purple-400">Quantum Resonance</div>
      <canvas
        ref={canvasRef}
        width={260}
        height={220}
        className="rounded-lg cursor-pointer"
        onClick={() => population[0] && onSelect(population[0])}
      />
      {population[0] && (
        <div className="mt-2 text-xs grid grid-cols-2 gap-2">
          <div className="bg-gray-900/50 p-2 rounded">
            <div className="text-gray-500">Best Fitness</div>
            <div className="text-purple-400 font-mono">{population[0].fitness.toFixed(2)}</div>
          </div>
          <div className="bg-gray-900/50 p-2 rounded">
            <div className="text-gray-500">Coherence</div>
            <div className="text-orange-400 font-mono">{(population[0].coherence * 100).toFixed(0)}%</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Static shape generator for components
function generateShapeStatic(genome, scale) {
  const points = [];
  const numPoints = 80;
  
  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints;
    const angle = t * Math.PI * 2;
    
    let x, y;
    
    if (genome.shapeType < 0.25) {
      const r = genome.radiusX * scale;
      x = Math.cos(angle) * r;
      y = Math.sin(angle) * r;
    } else if (genome.shapeType < 0.5) {
      x = Math.cos(angle) * genome.radiusX * scale;
      y = Math.sin(angle) * genome.radiusY * scale;
    } else if (genome.shapeType < 0.75) {
      const progress = t * genome.spiralTurns;
      const r = (0.2 + progress * genome.spiralTightness) * scale;
      x = Math.cos(angle * genome.spiralTurns) * r;
      y = Math.sin(angle * genome.spiralTurns) * r;
    } else {
      x = (t - 0.5) * scale * 1.8;
      y = Math.sin(t * Math.PI * 2) * genome.radiusY * scale * 0.5;
    }
    
    let foldOffset = 0;
    genome.folds.forEach(fold => {
      foldOffset += fold.amp * Math.sin(fold.freq * angle + fold.phase);
    });
    
    const normalAngle = angle + Math.PI / 2;
    x += Math.cos(normalAngle) * foldOffset * scale;
    y += Math.sin(normalAngle) * foldOffset * scale;
    
    const s = genome.alignmentBias + 
      Math.sin(t * Math.PI * 4 + genome.alignmentVariance * 10) * genome.alignmentVariance;
    
    points.push({ x, y, s: Math.max(0, Math.min(1, s)) });
  }
  
  return points;
}

export default MitoSwimbots;
