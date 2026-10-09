const introScreen = document.getElementById('intro-screen');
const gameShell = document.getElementById('game-shell');
const startGameBtn = document.getElementById('start-game-btn');

function startGame() {
  document.body.classList.add('game-started');
  introScreen.hidden = true;
  gameShell.hidden = false;
  gameShell.style.display = 'block';
  inputEl.focus();
}

startGameBtn.addEventListener('click', startGame);

introScreen.hidden = false;
gameShell.hidden = true;
gameShell.style.display = 'none';

const rooms = {
  airlock: {
    name: 'Airlock',
    description:
      'The outer airlock hums with recycled oxygen and a cold metal smell. A faded star map glows on the wall beside the hatch.',
    exits: { north: 'dockingBay', east: 'maintenanceCorridor' },
    items: ['oxygen key'],
  },
  dockingBay: {
    name: 'Docking Bay',
    description:
      'A wide bay echoes with the distant chime of customs drones. Cargo crates are bolted to the floor, and a shuttle sits in the far corner.',
    exits: { south: 'airlock', west: 'habitatRing', east: 'commandDeck' },
    items: ['fuel cell'],
  },
  habitatRing: {
    name: 'Habitat Ring',
    description:
      'The habitat ring is lined with glass domes and sleep pods. A low green light bathes the corridor, making everything feel eerily calm.',
    exits: { east: 'dockingBay', north: 'observationDeck', south: 'crewQuarters' },
    items: ['medkit'],
  },
  observationDeck: {
    name: 'Observation Deck',
    description:
      'The deck looks out into deep space. Broken asteroid shards drift past the windows while the ship shudders gently in the dark. A faint distress beacon blinks on an old monitor.',
    exits: { south: 'habitatRing' },
    items: [],
  },
  commandDeck: {
    name: 'Command Deck',
    description:
      'The bridge is quiet except for the pulse of old control panels and static-filled comms. The ship core status display flickers red.',
    exits: { west: 'dockingBay', north: 'reactorCore' },
    items: ['nav console'],
  },
  reactorCore: {
    name: 'Reactor Core',
    description:
      'The reactor chamber is a warm, humming cylinder of light. The main core is unstable, and a glowing flux core is mounted in the harness.',
    exits: { south: 'commandDeck' },
    items: ['flux core'],
  },
  maintenanceCorridor: {
    name: 'Maintenance',
    description:
      'The maintenance corridor is lined with service cabinets, spare parts, and utility pipes. A cracked emergency panel glows beside a sealed access hatch. Sparks flicker from a damaged compartment.',
    exits: { west: 'airlock' },
    items: ['repair patch'],
  },
  crewQuarters: {
    name: 'Crew Quarters',
    description:
      'Personal quarters are strewn with personal effects and emergency rations. A wall panel displays the crew roster—most names are crossed out. The air feels heavy here.',
    exits: { north: 'habitatRing' },
    items: [],
  },
};

const state = {
  currentRoom: 'airlock',
  inventory: [],
  visited: new Set(['airlock']),
  gameWon: false,
  crewSaved: false,
  systemsRepaired: false,
  suppliesFound: false,
  generalMessage: '',
};

const outputEl = document.getElementById('game-output');
const formEl = document.getElementById('command-form');
const inputEl = document.getElementById('command-input');
const statusEl = document.getElementById('status-pill');
const mapDisplayEl = document.getElementById('map-display');
const mapSvgContainer = document.getElementById('map-svg');
const mapTextEl = document.getElementById('map-text');
const mobileNavigationEl = document.getElementById('mobile-navigation');

// Canvas starfield: draws sparse animated stars for a natural look
function initStarfield() {
  const container = document.getElementById('starfield');
  if (!container) return;
  // avoid double-init
  if (container._starCanvas) return;

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  container._starCanvas = canvas;
  const ctx = canvas.getContext('2d');

  let DPR = window.devicePixelRatio || 1;
  function resize() {
    DPR = window.devicePixelRatio || 1;
    const w = Math.max(320, Math.floor(window.innerWidth));
    const h = Math.max(240, Math.floor(window.innerHeight));
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  const stars = [];
  const STAR_COUNT = 120;
  function initStars() {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.6 + 0.4,
        speed: Math.random() * 0.12 + 0.02,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.6 + Math.random() * 0.4,
      });
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    const w = canvas.width / DPR;
    const h = canvas.height / DPR;
    ctx.clearRect(0, 0, w, h);
    // subtle nebula tint behind stars
    ctx.fillStyle = 'rgba(6,18,28,0.06)';
    ctx.fillRect(0, 0, w, h);

    for (let s of stars) {
      s.y += s.speed * (50 * dt);
      if (s.y > h + 10) s.y = -10;
      // twinkle
      const tw = 0.5 + 0.5 * Math.sin(now / 400 + s.phase);
      const a = Math.max(0.2, Math.min(1, s.alpha * tw));
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    resize();
    initStars();
  });

  resize();
  initStars();
  requestAnimationFrame(frame);
}

// initialize starfield immediately (script is loaded at end of body)
initStarfield();

function appendLine(message, type = 'info') {
  const line = document.createElement('p');
  line.className = `output-line ${type}`;
  line.textContent = message;
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function updateMapDisplay() {
  const mapContent = [];
  
  // Items section
  mapContent.push('INVENTORY:');
  const itemLocations = [
    { item: 'oxygen key', location: 'Airlock' },
    { item: 'fuel cell', location: 'Docking Bay' },
    { item: 'medkit', location: 'Habitat Ring' },
    { item: 'repair patch', location: 'Maint. Corr.' },
    { item: 'flux core', location: 'Reactor Core' },
  ];
  
  itemLocations.forEach((entry) => {
    const inInventory = state.inventory.some((item) => 
      item.toLowerCase() === entry.item.toLowerCase()
    );
    const indicator = inInventory ? '✓' : '○';
    const label = inInventory ? entry.item : entry.item;
    mapContent.push(`${indicator} ${label}`);
  });
  
  mapContent.push('');
  mapContent.push('OBJECTIVES:');
  const objectives = [
    { task: 'Get Flux Core', done: state.inventory.some((item) => item.toLowerCase() === 'flux core') },
    { task: 'Reach Cmd Deck', done: state.currentRoom === 'commandDeck' },
    { task: 'Win Mission', done: state.gameWon },
    { task: 'Save Crew', done: state.crewSaved },
    { task: 'Repair Ship', done: state.systemsRepaired },
  ];
  
  objectives.forEach((obj) => {
    const check = obj.done ? '✓' : '○';
    mapContent.push(`${check} ${obj.task}`);
  });
  
  mapContent.push('');
  mapContent.push(`CURRENT: ${rooms[state.currentRoom]?.name || 'Unknown'}`);
  mapContent.push(`INVENTORY: ${state.inventory.length} items`);
  
  if (mapTextEl) mapTextEl.textContent = mapContent.join('\n');
}

function updateMobileNavigation() {
  if (!mobileNavigationEl) return;
  mobileNavigationEl.replaceChildren();

  Object.entries(rooms[state.currentRoom].exits || {}).forEach(([direction, destination]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'navigation-button';
    button.dataset.direction = direction;
    button.textContent = direction;
    button.setAttribute('aria-label', `Go ${direction} to ${rooms[destination].name}`);
    button.addEventListener('click', () => handleMove(direction));
    mobileNavigationEl.appendChild(button);
  });
}

// Positions for SVG map nodes (x,y in 0..100 coordinate space)
const roomPositions = {
  // Core & bridge area (north is smaller y)
  reactorCore: { x: 50, y: 8 },
  commandDeck: { x: 50, y: 28 },

  // Docking should be west of commandDeck
  dockingBay: { x: 34, y: 44 },
  // Airlock sits south of docking
  airlock: { x: 34, y: 70 },

  // Habitat cluster further west of docking
  habitatRing: { x: 18, y: 44 },
  observationDeck: { x: 18, y: 28 },
  crewQuarters: { x: 18, y: 70 },

  // Maintenance corridor off the airlock (east of airlock)
  maintenanceCorridor: { x: 50, y: 70 },
};

function renderSvgMap() {
  if (!mapSvgContainer) return;
  mapSvgContainer.innerHTML = '';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // draw edges (only once per pair)
  const seen = new Set();
  Object.keys(rooms).forEach((key) => {
    const pos = roomPositions[key];
    if (!pos) return;
    const exits = rooms[key].exits || {};
    Object.values(exits).forEach((dest) => {
      const pair = [key, dest].sort().join('|');
      if (seen.has(pair)) return;
      seen.add(pair);
      const dpos = roomPositions[dest];
      if (!dpos) return;
      // use coordinates directly (y: 0..100, 0 = top). Smaller y means more north (up).
      const y1 = pos.y;
      const y2 = dpos.y;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', pos.x);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', dpos.x);
      line.setAttribute('y2', y2);
      line.setAttribute('class', 'map-edge');
      svg.appendChild(line);
    });
  });

  // draw nodes
  Object.keys(roomPositions).forEach((key) => {
    const p = roomPositions[key];
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `map-node map-node-${key}`);
    g.setAttribute('data-room', key);
    // use coordinates directly (y increases downward in SVG; smaller y values are visually higher)
    const py = p.y;
    g.setAttribute('transform', `translate(${p.x}, ${py})`);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', 0);
    circle.setAttribute('cy', 0);
    circle.setAttribute('r', 1.8);
    g.appendChild(circle);

    const label = document.createElementNS(svgNS, 'text');
    const fullName = rooms[key].name || key;
    // Position labels to avoid overlap: prefer left/right depending on node X
    const offsetX = p.x > 70 ? -4 : (p.x < 30 ? 6 : 6);
    const anchor = p.x > 70 ? 'end' : 'start';
    // Nudges vertical label position if node is very top or very bottom
    const offsetY = p.y < 12 ? 6 : (p.y > 85 ? -6 : 3);
    label.setAttribute('x', offsetX);
    label.setAttribute('y', offsetY);
    label.setAttribute('text-anchor', anchor);
    label.setAttribute('class', 'map-label');
    // Shorten long labels visually; full name available as tooltip
    label.textContent = fullName.length > 18 ? fullName.slice(0, 15) + '…' : fullName;
    const title = document.createElementNS(svgNS, 'title');
    title.textContent = fullName;
    g.appendChild(title);
    g.appendChild(label);

    // clickable to attempt move
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      moveToRoom(key);
    });

    svg.appendChild(g);
  });

  mapSvgContainer.appendChild(svg);
  updateSvgHighlight();

  // Simple overlap resolver: nudge overlapping labels apart (few iterations)
  try {
    const labels = Array.from(svg.querySelectorAll('.map-label'));
    let iter = 0;
    let changed = true;
    while (changed && iter < 6) {
      changed = false;
      iter++;
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i].getBBox();
          const b = labels[j].getBBox();
          if (!(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y)) {
            const yi = parseFloat(labels[i].getAttribute('y') || '0');
            const yj = parseFloat(labels[j].getAttribute('y') || '0');
            const delta = 3;
            if (yi <= yj) {
              labels[i].setAttribute('y', yi - delta);
              labels[j].setAttribute('y', yj + delta);
            } else {
              labels[i].setAttribute('y', yi + delta);
              labels[j].setAttribute('y', yj - delta);
            }
            changed = true;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Label collision resolver skipped:', e);
  }
}

function updateSvgHighlight() {
  if (!mapSvgContainer) return;
  const svg = mapSvgContainer.querySelector('svg');
  if (!svg) return;
  svg.querySelectorAll('.map-node').forEach((n) => n.classList.remove('current'));
  const currentNode = svg.querySelector(`.map-node-${state.currentRoom}`);
  if (currentNode) currentNode.classList.add('current');

  // update external current-room label (outside the SVG)
  const outer = document.getElementById('map-current-name');
  if (outer) {
    const name = (rooms[state.currentRoom] && rooms[state.currentRoom].name) || state.currentRoom;
    outer.textContent = name;
  }
}

function moveToRoom(targetKey) {
  const room = rooms[state.currentRoom];
  const exits = Object.values(room.exits || {});
  if (exits.includes(targetKey)) {
    state.currentRoom = targetKey;
    appendLine(`You move to ${rooms[targetKey].name}.`, 'system');
    renderRoom();
    updateMapDisplay();
    updateSvgHighlight();
  } else {
    appendLine('You cannot reach that location directly from here.', 'warning');
  }
}

function roomDescription() {
  const current = rooms[state.currentRoom];
  const exits = Object.keys(current.exits);
  const items = current.items.length ? `Items here: ${current.items.join(', ')}.` : 'No items visible.';
  appendLine(`\n${current.name}: ${current.description}`, 'info');
  appendLine(items, 'info');
  appendLine(`Exits: ${exits.join(', ') || 'none'}.`, 'system');
}

function statusText() {
  statusEl.textContent = state.gameWon ? 'Mission Complete' : 'Exploring';
}

function saveGame() {
  const payload = {
    currentRoom: state.currentRoom,
    inventory: state.inventory,
    visited: [...state.visited],
    gameWon: state.gameWon,
    crewSaved: state.crewSaved,
    systemsRepaired: state.systemsRepaired,
  };
  localStorage.setItem('deep-drift-save', JSON.stringify(payload));
  appendLine('Progress saved.', 'system');
}

function loadGame() {
  const saved = localStorage.getItem('deep-drift-save');
  if (!saved) {
    appendLine('No saved progress found.', 'warning');
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.currentRoom = parsed.currentRoom || 'airlock';
    state.inventory = parsed.inventory || [];
    state.visited = new Set(parsed.visited || ['airlock']);
    state.gameWon = Boolean(parsed.gameWon);
    state.crewSaved = Boolean(parsed.crewSaved);
    state.systemsRepaired = Boolean(parsed.systemsRepaired);
    appendLine('Saved progress restored.', 'system');
    renderRoom();
    updateSvgHighlight();
  } catch (error) {
    appendLine('Could not load saved game.', 'warning');
  }
}

function resetGame() {
  state.currentRoom = 'airlock';
  state.inventory = [];
  state.visited = new Set(['airlock']);
  state.gameWon = false;
  state.crewSaved = false;
  state.systemsRepaired = false;
  localStorage.removeItem('deep-drift-save');
  appendLine('A fresh mission begins.', 'system');
  renderRoom();
  updateSvgHighlight();
}

function renderRoom() {
  const room = rooms[state.currentRoom];
  if (!room) {
    appendLine('You drift into empty space. Nothing is here.', 'warning');
    return;
  }

  state.visited.add(state.currentRoom);
  roomDescription();
  statusText();
  updateMapDisplay();
  updateSvgHighlight();
  updateMobileNavigation();
}

// Victory celebration: banner, confetti canvas, and chime
function celebrateVictory() {
  try {
    // audio chime (simple chord)
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, t);
      osc2.frequency.setValueAtTime(660, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
      osc1.start(t); osc2.start(t);
      osc1.stop(t + 1.6); osc2.stop(t + 1.6);
    }
  } catch (e) {
    console.warn('Audio not available for victory chime', e);
  }

  // banner
  const existing = document.querySelector('.victory-banner');
  if (!existing) {
    const banner = document.createElement('div');
    banner.className = 'victory-banner';
    banner.textContent = 'Mission Complete — Deep Drift Stabilized';
    document.body.appendChild(banner);
    setTimeout(() => {
      banner.style.transition = 'opacity 600ms ease, transform 600ms ease';
      banner.style.opacity = '0';
      banner.style.transform = 'translateX(-50%) scale(0.9)';
      setTimeout(() => banner.remove(), 7000);
    }, 3800);
  }

  // confetti canvas
  const existingCanvas = document.querySelector('.confetti-canvas');
  if (existingCanvas) return;
  const cvs = document.createElement('canvas');
  cvs.className = 'confetti-canvas';
  cvs.width = window.innerWidth;
  cvs.height = window.innerHeight;
  document.body.appendChild(cvs);
  const cctx = cvs.getContext('2d');
  const confetti = [];
  const COUNT = 140;
  const colors = ['#7af0b6', '#7ee7ff', '#ffd36e', '#ff8e8e', '#b4ffea'];
  for (let i = 0; i < COUNT; i++) {
    confetti.push({
      x: Math.random() * cvs.width,
      y: Math.random() * cvs.height - cvs.height,
      w: 6 + Math.random() * 8,
      h: 6 + Math.random() * 8,
      vx: Math.random() * 200 - 100,
      vy: 40 + Math.random() * 160,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  let lastTime = performance.now();
  function confettiFrame(now) {
    const dt = Math.min(64, now - lastTime) / 1000;
    lastTime = now;
    cctx.clearRect(0, 0, cvs.width, cvs.height);
    for (const p of confetti) {
      p.x += p.vx * dt * 0.2;
      p.y += p.vy * dt;
      p.vy += 40 * dt; // gravity
      p.rot += p.vr;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.fillStyle = p.color;
      cctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      cctx.restore();
    }
    // stop after duration
    if (performance.now() - startTime > 8000) {
      cvs.remove();
      return;
    }
    requestAnimationFrame(confettiFrame);
  }
  const startTime = performance.now();
  requestAnimationFrame(confettiFrame);

  // highlight title briefly
  const titleEl = document.querySelector('.title-text');
  if (titleEl) {
    titleEl.classList.add('title-victory');
    setTimeout(() => titleEl.classList.remove('title-victory'), 4400);
  }
}

function getDirectionAlias(input) {
  const aliases = {
    n: 'north',
    s: 'south',
    e: 'east',
    w: 'west',
    north: 'north',
    south: 'south',
    east: 'east',
    west: 'west',
    go: null,
  };

  return aliases[input] || input;
}

function handleLook() {
  renderRoom();
}

function handleInventory() {
  const items = state.inventory.length ? state.inventory.join(', ') : 'empty';
  appendLine(`Inventory: ${items}.`, 'system');
}

function handleTake(itemName) {
  const room = rooms[state.currentRoom];
  if (!itemName) {
    appendLine('Take what?', 'warning');
    return;
  }

  const item = room.items.find((entry) => entry.toLowerCase() === itemName.toLowerCase());
  if (!item) {
    appendLine(`You do not see a ${itemName} here.`, 'warning');
    return;
  }

  room.items = room.items.filter((entry) => entry !== item);
  state.inventory.push(item);
  appendLine(`You take the ${item}.`, 'system');
  updateMapDisplay();
}

function handleUse(itemName) {
  if (!itemName) {
    appendLine('Use what?', 'warning');
    return;
  }

  const normalized = itemName.toLowerCase();
  const inInventory = state.inventory.some((item) => item.toLowerCase() === normalized);

  // Win condition: flux core at command deck
  if (state.currentRoom === 'commandDeck' && normalized === 'flux core') {
    if (!inInventory) {
      appendLine('You need the flux core before you can stabilize the ship.', 'warning');
      return;
    }

    state.gameWon = true;
    state.inventory = state.inventory.filter((item) => item.toLowerCase() !== 'flux core');
    statusText();
    appendLine('You slot the flux core into the nav console. The ship hums back to life and the mission is a success.', 'system');
    appendLine('The stars outside the bridge glow bright again as the Deep Drift resumes its course.', 'info');
    updateMapDisplay();
    celebrateVictory();
    return;
  }

  // Oxygen key at airlock
  if (state.currentRoom === 'airlock' && normalized === 'oxygen key') {
    if (!inInventory) {
      appendLine('You do not have an oxygen key.', 'warning');
      return;
    }
    appendLine('You unlock the emergency supply locker with the oxygen key. Inside, you find ration packs and technical manuals.', 'system');
    appendLine('They won\'t help you leave, but they confirm others were here before.', 'info');
    return;
  }

  // Fuel cell at docking bay
  if (state.currentRoom === 'dockingBay' && normalized === 'fuel cell') {
    if (!inInventory) {
      appendLine('You do not have a fuel cell.', 'warning');
      return;
    }
    appendLine('You insert the fuel cell into the shuttle\'s auxiliary power port. The shuttle\'s lights flicker to life.', 'system');
    appendLine('It\'s not enough to launch, but you can access the flight logs now. The last entry reads: "Reactor critical. All hands to emergency stations."', 'info');
    return;
  }

  // Medkit at observation deck (to help distressed crew)
  if (state.currentRoom === 'observationDeck' && normalized === 'medkit') {
    if (!inInventory) {
      appendLine('You do not have a medkit.', 'warning');
      return;
    }
    if (state.crewSaved) {
      appendLine('There is no one left to help here.', 'info');
      return;
    }
    appendLine('You respond to the distress signal. Dr. Chen\'s voice crackles through the comm, weakened but alive.', 'system');
    appendLine('"Thank... thank you. I\'m in the med bay. The reactor overload... I managed to seal it. Flux core is... in the core chamber."', 'info');
    appendLine('You have saved a crew member and learned the reactor location. The mission suddenly feels less lonely.', 'system');
    state.crewSaved = true;
    updateMapDisplay();
    return;
  }

  // Repair patch in maintenance corridor
  if (state.currentRoom === 'maintenanceCorridor' && normalized === 'repair patch') {
    if (!inInventory) {
      appendLine('You do not have a repair patch.', 'warning');
      return;
    }
    if (state.systemsRepaired) {
      appendLine('The systems are already repaired. There\'s nothing more to fix here.', 'info');
      return;
    }
    appendLine('You apply the repair patch to the damaged power conduit. Sparks stop flying and the panel stabilizes.', 'system');
    appendLine('The ship\'s secondary systems come back online. Life support is now at 87%.', 'info');
    state.systemsRepaired = true;
    updateMapDisplay();
    return;
  }

  if (inInventory) {
    appendLine(`You try to use the ${itemName}, but there's nothing here to use it on.`, 'info');
    return;
  }

  appendLine(`You do not have a ${itemName}.`, 'warning');
}

function handleMove(direction) {
  const room = rooms[state.currentRoom];
  const target = room.exits[direction];

  if (!target) {
    appendLine(`You cannot go ${direction} from here.`, 'warning');
    return;
  }

  state.currentRoom = target;
  appendLine(`You move ${direction}.`, 'system');
  renderRoom();
}

function handleHelp() {
  appendLine('Commands: look, inventory, take <item>, use <item>, go <direction>, examine <subject>, help, save, load, reset, map.', 'system');
  appendLine('Directions: north, south, east, west, or n/s/e/w. Shorthand: l=look, inv=inventory.', 'system');
}

function handleExamine(subject) {
  if (!subject) {
    appendLine('Examine what?', 'warning');
    return;
  }

  const norm = subject.toLowerCase();
  const room = rooms[state.currentRoom];

  if (state.currentRoom === 'observationDeck' && (norm === 'beacon' || norm === 'monitor' || norm === 'signal')) {
    appendLine('The distress beacon pulses with an intermittent signal. You pick up a voice transmission.', 'system');
    appendLine('"...Deep Drift to any listening... Dr. Chen, medical officer. Reactor critical. Need... need help."', 'info');
    appendLine('The beacon is still active. Someone is waiting for you.', 'system');
    return;
  }

  if (state.currentRoom === 'crewQuarters' && (norm === 'roster' || norm === 'panel' || norm === 'names')) {
    appendLine('The wall panel shows the crew manifest. Most entries have been scratched or marked "DECEASED".', 'system');
    appendLine('Only one name remains: "Dr. Sarah Chen - Medical Officer - Last Known Location: Medical Bay".', 'info');
    return;
  }

  if (state.currentRoom === 'dockingBay' && (norm === 'shuttle' || norm === 'shuttle logs')) {
    appendLine('The shuttle is pristine but disabled. Its flight computer might have logs...', 'system');
    if (state.inventory.some((item) => item.toLowerCase() === 'fuel cell')) {
      appendLine('If only you had power... A fuel cell might work.', 'info');
    } else {
      appendLine('You\'ll need a fuel cell to power it up.', 'info');
    }
    return;
  }

  if (state.currentRoom === 'commandDeck' && (norm === 'console' || norm === 'nav console' || norm === 'display')) {
    appendLine('The navigation console is dark. Its status display flickers weakly, showing: "REACTOR OFFLINE - CRITICAL ERROR".', 'system');
    appendLine('It will need the reactor\'s flux core to restart the ship.', 'info');
    return;
  }

  if (state.currentRoom === 'reactorCore' && (norm === 'core' || norm === 'light' || norm === 'chamber')) {
    appendLine('The reactor core glows with an unstable hum. At its center, a crystalline flux core sits mounted in a harness.', 'system');
    appendLine('It looks like exactly what the command deck needs.', 'info');
    return;
  }

  appendLine('You see nothing special about that.', 'info');
}

function handleMap() {
  appendLine('╔════════════════════════════════════════════════════════╗', 'system');
  appendLine('║           DEEP DRIFT - VESSEL SCHEMATIC MAP            ║', 'system');
  appendLine('╚════════════════════════════════════════════════════════╝', 'system');
  appendLine('', 'system');
  
  appendLine('     ┌──────────────────────────────────────────────┐', 'system');
  appendLine('     │  PRIMARY DECK (Cargo & Command)              │', 'system');
  appendLine('     └──────────────────────────────────────────────┘', 'system');
  appendLine('', 'system');
  
  appendLine('    [MAINT CORR]   [AIRLOCK]   [DOCKING BAY]   [CMD DECK]   [REACTOR]', 'info');
  appendLine('           │             │            │              │            │', 'info');
  appendLine('           └────────────┴──────┬─────┘              └────────────┘', 'info');
  appendLine('                               │', 'info');
  appendLine('                        [HABITAT RING]────────[OBSERVATION DECK]', 'info');
  appendLine('                               │', 'info');
  appendLine('                        [CREW QUARTERS]', 'info');
  appendLine('', 'system');
  
  appendLine('     ┌──────────────────────────────────────────────┐', 'system');
  appendLine('     │  ITEMS & OBJECTIVES                         │', 'system');
  appendLine('     └──────────────────────────────────────────────┘', 'system');
  appendLine('', 'system');
  
  const itemLocations = [
    { item: 'oxygen key', location: 'Airlock', hint: 'Emergency supplies' },
    { item: 'fuel cell', location: 'Docking Bay', hint: 'Shuttle power' },
    { item: 'medkit', location: 'Habitat Ring', hint: 'Crew rescue' },
    { item: 'repair patch', location: 'Maintenance', hint: 'Life support' },
    { item: 'flux core', location: 'Reactor Core', hint: '⭐ MISSION CRITICAL' },
  ];
  
  itemLocations.forEach((entry) => {
    const inInventory = state.inventory.some((item) => 
      item.toLowerCase() === entry.item.toLowerCase()
    );
    const indicator = inInventory ? '✓' : '○';
    appendLine(`  ${indicator} ${entry.item.padEnd(15)} @ ${entry.location.padEnd(20)} (${entry.hint})`, 'info');
  });
  
  appendLine('', 'system');
  appendLine('     ┌──────────────────────────────────────────────┐', 'system');
  appendLine('     │  MISSION STATUS                              │', 'system');
  appendLine('     └──────────────────────────────────────────────┘', 'system');
  appendLine('', 'system');
  
  const missionStatus = [
    { task: 'Recover Flux Core', done: state.inventory.some((item) => item.toLowerCase() === 'flux core') },
    { task: 'Reach Command Deck', done: state.currentRoom === 'commandDeck' },
    { task: 'Restore Ship Systems', done: state.gameWon },
    { task: 'Save Crew (Optional)', done: state.crewSaved },
    { task: 'Repair Life Support (Optional)', done: state.systemsRepaired },
  ];
  
  missionStatus.forEach((task) => {
    const check = task.done ? '✓' : '○';
    const status = task.done ? 'COMPLETE' : 'PENDING';
    appendLine(`  [${check}] ${task.task.padEnd(28)} ${status}`, task.done ? 'success' : 'system');
  });
  
  appendLine('', 'system');
  appendLine('Use commands: look, examine <subject>, take <item>, use <item>, go <direction>', 'system');
}

function parseCommand(rawInput) {
  const input = rawInput.trim();
  if (!input) {
    return;
  }

  appendLine(`> ${input}`, 'command');

  const tokens = input.split(/\s+/);
  const command = tokens[0].toLowerCase();
  const rest = tokens.slice(1).join(' ');

  if (state.gameWon && !['look', 'inventory', 'help', 'map', 'save', 'load', 'reset'].includes(command)) {
    appendLine('The ship is stable and the mission is complete. You can still explore, but the main objective is already won.', 'info');
    return;
  }

  switch (command) {
    case 'look':
    case 'l':
      handleLook();
      break;
    case 'inventory':
    case 'inv':
      handleInventory();
      break;
    case 'take':
      handleTake(rest);
      break;
    case 'use':
      handleUse(rest);
      break;
    case 'go':
    case 'move':
      handleMove(getDirectionAlias(rest.toLowerCase()));
      break;
    case 'n':
    case 's':
    case 'e':
    case 'w':
    case 'north':
    case 'south':
    case 'east':
    case 'west':
      handleMove(getDirectionAlias(command));
      break;
    case 'examine':
    case 'x':
    case 'read':
      handleExamine(rest);
      break;
    case 'help':
    case '?':
      handleHelp();
      break;
    case 'save':
      saveGame();
      break;
    case 'load':
      loadGame();
      break;
    case 'reset':
      resetGame();
      break;
    case 'map':
      handleMap();
      break;
    default:
      appendLine(`Unknown command: ${input}. Type "help" for a list of actions.`, 'warning');
  }
}

function init() {
  appendLine('Deep Drift online. Welcome aboard the research vessel.', 'system');
  appendLine('Your mission: restore the ship and return to stable orbit.', 'system');
  appendLine('Type "help" to see available commands.', 'system');
  renderRoom();
  renderSvgMap();
  updateMapDisplay();
}

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  parseCommand(inputEl.value);
  inputEl.value = '';
  inputEl.focus();
});

init();
