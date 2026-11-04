const hasDocument = typeof document !== 'undefined';

const rooms = {
  airlock: {
    name: 'Airlock',
    description: 'The outer airlock hums with recycled oxygen and a cold metal smell. A faded star map glows on the wall beside the hatch.',
    exits: { north: 'dockingBay', east: 'maintenanceCorridor' },
    items: ['oxygen key'],
  },
  dockingBay: {
    name: 'Docking Bay',
    description: 'A wide bay echoes with the distant chime of customs drones. Cargo crates are bolted to the floor, and a shuttle sits in the far corner.',
    exits: { south: 'airlock', west: 'habitatRing', east: 'commandDeck' },
    items: ['fuel cell'],
  },
  habitatRing: {
    name: 'Habitat Ring',
    description: 'The habitat ring is lined with glass domes and sleep pods. A low green light bathes the corridor, making everything feel eerily calm.',
    exits: { east: 'dockingBay', north: 'observationDeck', south: 'crewQuarters' },
    items: ['medkit'],
  },
  observationDeck: {
    name: 'Observation Deck',
    description: 'The deck looks out into deep space. Asteroid debris slams against the observation windows as the ship shudders in the dark. A faint distress beacon blinks on an old monitor.',
    exits: { south: 'habitatRing' },
    items: [],
  },
  commandDeck: {
    name: 'Command Deck',
    description: 'The bridge is quiet except for the pulse of old control panels and static-filled comms. The ship core status display flickers red. A flight console hums to life with a coarse navigation grid.',
    exits: { west: 'dockingBay', north: 'reactorCore' },
    items: ['nav console'],
  },
  reactorCore: {
    name: 'Reactor Core',
    description: 'The reactor chamber is a warm, humming cylinder of light. The main core is unstable, and a glowing flux core is mounted in the harness.',
    exits: { south: 'commandDeck' },
    items: ['flux core'],
  },
  maintenanceCorridor: {
    name: 'Maintenance',
    description: 'The maintenance corridor is lined with service cabinets, spare parts, and utility pipes. A cracked emergency panel glows beside a sealed access hatch. Sparks flicker from a damaged compartment.',
    exits: { west: 'airlock' },
    items: ['repair patch'],
  },
  crewQuarters: {
    name: 'Crew Quarters',
    description: 'Personal quarters are strewn with personal effects and emergency rations. A wall panel displays the crew roster—most names are crossed out. The air feels heavy here.',
    exits: { north: 'habitatRing' },
    items: [],
  },
};

const initialRoomItems = Object.fromEntries(
  Object.entries(rooms).map(([roomId, room]) => [roomId, [...room.items]]),
);

const MAX_OXYGEN_TURNS = 18;
const SIDE_QUEST_OXYGEN_REWARD = 4;

const CRAFTING_RECIPES = {
  fuel_cell: {
    name: 'Fuel Cell',
    requires: { minerals: 4 },
    operate: (ship) => {
      ship.fuel = Math.min(110, ship.fuel + 24);
      ship.modules.push('fuel_cell');
    },
  },
  alloy_patch: {
    name: 'Alloy Patch',
    requires: { minerals: 3 },
    operate: (ship) => {
      ship.hull = Math.min(110, ship.hull + 12);
      ship.modules.push('alloy_patch');
    },
  },
};

function generateGalaxy(count = 7) {
  const prefixes = ['Cinder', 'Iris', 'Hallow', 'Nimble', 'Velvet', 'Blackwater', 'Sunshade', 'Tideglass', 'Ember', 'Lattice', 'Rook', 'Cinder'];
  const types = ['asteroid', 'station', 'planet'];
  const hazards = ['low', 'medium', 'high'];
  const dests = [];

  for (let index = 0; index < count; index += 1) {
    const type = types[index % types.length];
    const name = `${prefixes[(index * 2) % prefixes.length]} ${index + 1}`;
    const travelTime = 12 + index * 4 + (type === 'planet' ? 6 : type === 'station' ? 4 : 2);
    dests.push({
      id: `${type}-${index + 1}`,
      type,
      name,
      summary: type === 'asteroid'
        ? 'Dense ore field with drift-salvage and hidden mineral seams.'
        : type === 'station'
          ? 'A crowded trade port in a narrow trade lane.'
          : 'A habitable world with unstable weather and deep biomes.',
      hazard: hazards[index % hazards.length],
      fuelCost: 8 + index * 3,
      travelTime,
      reward: type === 'asteroid' ? 'ore' : type === 'station' ? 'trade goods' : 'biome samples',
      biome: type === 'planet' ? ['forest', 'cave', 'ocean'][index % 3] : 'none',
      legalStatus: type === 'station' ? 'regulated' : 'open',
    });
  }

  return dests;
}

function createPhase2State() {
  const destinations = generateGalaxy(7);
  return {
    ship: {
      hull: 100,
      fuel: 90,
      shields: 40,
      credits: 45,
      minerals: 6,
      cargo: [],
      cargoLimit: 18,
      modules: ['nav_console', 'basic_scanner'],
      upgrades: { engine: 1, mining: 1, shield: 1 },
    },
    destinations,
    phase2: {
      currentDestination: null,
      locationStatus: 'dock',
      travelling: false,
      routeId: null,
      travelStartedAt: null,
      activeZone: null,
    },
  };
}

function startFlight(state, routeId, onArrival) {
  if (state.phase2 && state.phase2.travelling) {
    return { traveling: false, routeId: null, reason: 'Already in transit.' };
  }
  if (state.phase2 && state.phase2.locationStatus === 'landed') {
    return { traveling: false, routeId: null, reason: 'Board your ship before launching another route.' };
  }

  const destination = (state.destinations || []).find((item) => item.id === routeId || item.name.toLowerCase() === routeId.toLowerCase());
  if (!destination) {
    return { traveling: false, routeId: null, reason: 'Unknown destination.' };
  }

  if ((state.ship || {}).fuel < destination.fuelCost) {
    return { traveling: false, routeId: null, reason: `Not enough fuel for ${destination.name}.` };
  }

  state.ship.fuel = Math.max(0, state.ship.fuel - destination.fuelCost);
  state.phase2 = state.phase2 || {};
  state.phase2.travelling = true;
  state.phase2.routeId = destination.id;
  state.phase2.travelStartedAt = Date.now();
  state.phase2.locationStatus = 'traveling';

  if (typeof setTimeout === 'function') {
    setTimeout(() => {
      resolveTravel(state, destination.id);
      if (typeof onArrival === 'function') onArrival(destination);
    }, destination.travelTime * 1000);
  }

  return { traveling: true, routeId: destination.id, ship: state.ship };
}

function resolveTravel(state, routeId) {
  const destination = (state.destinations || []).find((item) => item.id === routeId || item.name.toLowerCase() === routeId.toLowerCase());
  if (!destination) {
    return state.phase2;
  }

  state.phase2 = state.phase2 || {};
  state.phase2.travelling = false;
  state.phase2.routeId = null;
  state.phase2.currentDestination = destination;
  state.phase2.locationStatus = 'landed';
  state.phase2.activeZone = destination.type === 'planet' ? destination.biome : 'landing bay';

  return state.phase2;
}

function craftItem(state, recipeId) {
  const recipe = CRAFTING_RECIPES[recipeId];
  if (!recipe) {
    return { success: false, reason: 'Unknown recipe.' };
  }

  const required = recipe.requires || {};
  if ((state.ship || {}).minerals < (required.minerals || 0)) {
    return { success: false, reason: `Not enough minerals to craft ${recipe.name}.` };
  }

  state.ship.minerals -= required.minerals;
  recipe.operate(state.ship);

  return {
    success: true,
    ship: state.ship,
    message: `${recipe.name} assembled on the ship.`,
  };
}

function normalizeTravelDestination(input) {
  return input.trim().replace(/^to\s+/i, '');
}

const state = {
  currentRoom: 'airlock',
  inventory: [],
  visited: new Set(['airlock']),
  oxygenTurns: MAX_OXYGEN_TURNS,
  gameWon: false,
  gameOver: false,
  crewSaved: false,
  systemsRepaired: false,
  generalMessage: '',
  ship: {
    hull: 100,
    fuel: 90,
    shields: 40,
    credits: 45,
    minerals: 6,
    cargo: [],
    cargoLimit: 18,
    modules: ['nav_console', 'basic_scanner'],
    upgrades: { engine: 1, mining: 1, shield: 1 },
  },
  phase2: {
    currentDestination: null,
    locationStatus: 'dock',
    travelling: false,
    routeId: null,
    travelStartedAt: null,
    activeZone: null,
    destinations: generateGalaxy(7),
  },
};

state.destinations = state.phase2.destinations;

if (hasDocument) {
  const introScreen = document.getElementById('intro-screen');
  const gameShell = document.getElementById('game-shell');
  const startGameBtn = document.getElementById('start-game-btn');
  const outputEl = document.getElementById('game-output');
  const formEl = document.getElementById('command-form');
  const inputEl = document.getElementById('command-input');
  const statusEl = document.getElementById('status-pill');
  const mapTextEl = document.getElementById('map-text');
  const mobileNavigationEl = document.getElementById('mobile-navigation');
  const roomActionsEl = document.getElementById('room-actions');
  const mapPanelEl = document.getElementById('map-panel');
  const mapSvgContainer = document.getElementById('map-svg');
  const mobileLayoutQuery = window.matchMedia('(max-width: 680px)');
  let mapPanelUsesMobileLayout = mobileLayoutQuery.matches;

  function appendLine(message, type = 'info') {
    const line = document.createElement('p');
    line.className = `output-line ${type}`;
    line.textContent = message;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function syncMapPanelToViewport() {
    const usesMobileLayout = window.innerWidth <= 680;
    if (usesMobileLayout !== mapPanelUsesMobileLayout) {
      mapPanelEl.open = !usesMobileLayout;
    }
    mapPanelUsesMobileLayout = usesMobileLayout;
  }

  function initStarfield() {
    const container = document.getElementById('starfield');
    if (!container || container._starCanvas) return;
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
      ctx.fillStyle = 'rgba(6,18,28,0.06)';
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        s.y += s.speed * (50 * dt);
        if (s.y > h + 10) s.y = -10;
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

  function statusText() {
    statusEl.textContent = state.gameWon ? 'Mission Complete' : state.gameOver ? 'No Oxygen' : `O2 ${state.oxygenTurns}/${oxygenCapacity()}`;
    statusEl.classList.toggle('is-danger', state.gameOver);
    statusEl.classList.toggle('is-success', state.gameWon);
  }

  function oxygenCapacity() {
    return MAX_OXYGEN_TURNS + (state.crewSaved ? SIDE_QUEST_OXYGEN_REWARD : 0) + (state.systemsRepaired ? SIDE_QUEST_OXYGEN_REWARD : 0);
  }

  function updateMapDisplay() {
    const mapContent = [];
    mapContent.push('INVENTORY:');
    for (const entry of [
      { item: 'oxygen key', location: 'Airlock' },
      { item: 'fuel cell', location: 'Docking Bay' },
      { item: 'medkit', location: 'Habitat Ring' },
      { item: 'repair patch', location: 'Maint. Corr.' },
      { item: 'flux core', location: 'Reactor Core' },
    ]) {
      const inInventory = state.inventory.some((item) => item.toLowerCase() === entry.item.toLowerCase());
      const indicator = inInventory ? '✓' : '○';
      mapContent.push(`${indicator} ${entry.item}`);
    }
    mapContent.push('');
    mapContent.push('OBJECTIVES:');
    mapContent.push(`${state.inventory.some((item) => item.toLowerCase() === 'flux core') ? '✓' : '○'} Get Flux Core`);
    mapContent.push(`${state.currentRoom === 'commandDeck' ? '✓' : '○'} Reach Cmd Deck`);
    mapContent.push(`${state.gameWon ? '✓' : '○'} Win Mission`);
    mapContent.push(`${state.crewSaved ? '✓' : '○'} Save Crew`);
    mapContent.push(`${state.systemsRepaired ? '✓' : '○'} Repair Ship`);
    mapContent.push('');
    mapContent.push(`CURRENT: ${rooms[state.currentRoom].name}`);
    mapTextEl.textContent = mapContent.join('\n');
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
      button.addEventListener('click', () => parseCommand(direction));
      mobileNavigationEl.appendChild(button);
    });
  }

  function updateRoomActions() {
    if (!roomActionsEl) return;
    roomActionsEl.replaceChildren();
    if (state.gameWon || state.gameOver) return;

    const actions = rooms[state.currentRoom].items.map((item) => ({ label: `Take ${item}`, command: `take ${item}` }));
    if (state.currentRoom === 'commandDeck') {
      actions.push({ label: 'Flight Console', command: 'flight' });
      actions.push({ label: 'Ship Status', command: 'ship' });
    }
    const examinationTargets = {
      dockingBay: 'shuttle',
      observationDeck: 'beacon',
      crewQuarters: 'roster',
      commandDeck: 'console',
      reactorCore: 'core',
    };
    if (examinationTargets[state.currentRoom]) {
      actions.push({ label: `Examine ${examinationTargets[state.currentRoom]}`, command: `examine ${examinationTargets[state.currentRoom]}` });
    }
    const usableItems = {
      airlock: 'oxygen key',
      dockingBay: 'fuel cell',
      observationDeck: 'medkit',
      maintenanceCorridor: 'repair patch',
      commandDeck: 'flux core',
    };
    const usableItem = state.currentRoom === 'observationDeck' && state.crewSaved
      ? null
      : state.currentRoom === 'maintenanceCorridor' && state.systemsRepaired
        ? null
        : usableItems[state.currentRoom];
    if (usableItem && state.inventory.some((item) => item.toLowerCase() === usableItem)) {
      actions.push({ label: `Use ${usableItem}`, command: `use ${usableItem}` });
    }
    if (state.phase2.currentDestination && state.phase2.locationStatus === 'landed') {
      actions.push({ label: 'Explore Site', command: 'explore' });
      actions.push({ label: 'Mine', command: 'mine' });
      actions.push({ label: 'Trade', command: 'trade list' });
      actions.push({ label: 'Board Ship', command: 'board' });
    } else if (state.phase2.currentDestination && state.phase2.locationStatus === 'orbit') {
      actions.push({ label: 'Land at Site', command: 'land' });
    }
    if (state.phase2.travelling) {
      actions.push({ label: 'Craft', command: 'craft fuel_cell' });
      actions.push({ label: 'Ship Status', command: 'ship' });
    }

    actions.forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'room-action-button';
      button.textContent = action.label;
      button.addEventListener('click', () => parseCommand(action.command));
      roomActionsEl.appendChild(button);
    });
  }

  const roomPositions = {
    reactorCore: { x: 50, y: 8 },
    commandDeck: { x: 50, y: 28 },
    dockingBay: { x: 34, y: 44 },
    airlock: { x: 34, y: 70 },
    habitatRing: { x: 18, y: 44 },
    observationDeck: { x: 18, y: 28 },
    crewQuarters: { x: 18, y: 70 },
    maintenanceCorridor: { x: 50, y: 70 },
  };

  function renderSvgMap() {
    if (!mapSvgContainer) return;
    mapSvgContainer.innerHTML = '';
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const seen = new Set();
    Object.keys(rooms).forEach((key) => {
      const pos = roomPositions[key];
      if (!pos) return;
      Object.values(rooms[key].exits || {}).forEach((dest) => {
        const pair = [key, dest].sort().join('|');
        if (seen.has(pair)) return;
        seen.add(pair);
        const dpos = roomPositions[dest];
        if (!dpos) return;
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', pos.x);
        line.setAttribute('y1', pos.y);
        line.setAttribute('x2', dpos.x);
        line.setAttribute('y2', dpos.y);
        line.setAttribute('class', 'map-edge');
        svg.appendChild(line);
      });
    });

    Object.keys(roomPositions).forEach((key) => {
      const p = roomPositions[key];
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', `map-node map-node-${key}`);
      g.setAttribute('transform', `translate(${p.x}, ${p.y})`);
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', 0);
      circle.setAttribute('cy', 0);
      circle.setAttribute('r', 1.8);
      g.appendChild(circle);
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', p.x > 70 ? -4 : 6);
      label.setAttribute('y', p.y < 12 ? 6 : (p.y > 85 ? -6 : 3));
      label.setAttribute('class', 'map-label');
      label.textContent = rooms[key].name;
      g.appendChild(label);
      svg.appendChild(g);
    });

    mapSvgContainer.appendChild(svg);
    svg.querySelectorAll('.map-node').forEach((node) => node.classList.remove('current'));
    const currentNode = svg.querySelector(`.map-node-${state.currentRoom}`);
    if (currentNode) currentNode.classList.add('current');
  }

  function roomDescription() {
    const current = rooms[state.currentRoom];
    const exits = Object.keys(current.exits);
    const items = current.items.length ? `Items here: ${current.items.join(', ')}.` : 'No items visible.';
    appendLine(`\n${current.name}: ${current.description}`, 'info');
    if (state.currentRoom === 'maintenanceCorridor' && !state.systemsRepaired) {
      appendLine('A sharp hiss cuts through the air from the leaking conduit.', 'warning');
    }
    if (state.currentRoom === 'observationDeck' && !state.crewSaved) {
      appendLine('Asteroid debris batters the windows. Actions here cost 2 oxygen until Dr. Chen guides you through the impact zone.', 'warning');
    }
    if (state.currentRoom === 'commandDeck') {
      appendLine('Command deck flight interface active. Type "flight" to view routes or "travel to <name>" to launch.', 'system');
    }
    appendLine(items, 'info');
    appendLine(`Exits: ${exits.join(', ') || 'none'}.`, 'system');
  }

  function renderRoom() {
    const room = rooms[state.currentRoom];
    if (!room) return;
    state.visited.add(state.currentRoom);
    roomDescription();
    statusText();
    updateMapDisplay();
    renderSvgMap();
    updateMobileNavigation();
    updateRoomActions();
  }

  function handleTake(itemName) {
    const room = rooms[state.currentRoom];
    const item = room.items.find((entry) => entry.toLowerCase() === itemName.toLowerCase());
    if (!item) {
      appendLine(`You do not see a ${itemName} here.`, 'warning');
      return false;
    }
    room.items = room.items.filter((entry) => entry !== item);
    state.inventory.push(item);
    appendLine(`You take the ${item}.`, 'system');
    updateMapDisplay();
    return true;
  }

  function getMissionEnding() {
    if (state.crewSaved && state.systemsRepaired) {
      return {
        title: 'Rescue Beacon',
        description: 'Dr. Chen joins you on the bridge. With life support restored, the Deep Drift returns home and broadcasts a signal for any other survivors.',
      };
    }
    if (state.crewSaved) {
      return {
        title: 'Last-Minute Evacuation',
        description: 'Dr. Chen guides you toward home, but failing life support forces an evacuation at the nearest station.',
      };
    }
    if (state.systemsRepaired) {
      return {
        title: 'Silent Homecoming',
        description: 'Life support holds and the ship reaches home, but Dr. Chen never answers. You leave a beacon active for anyone still out there.',
      };
    }
    return {
      title: 'Fragile Return',
      description: 'The ship begins the long trip home on failing life support, leaving the distress signal unanswered.',
    };
  }

  function handleUse(itemName) {
    if (!itemName) {
      appendLine('Use what?', 'warning');
      return false;
    }
    const normalized = itemName.toLowerCase();
    const inInventory = state.inventory.some((item) => item.toLowerCase() === normalized);

    if (state.currentRoom === 'commandDeck' && normalized === 'flux core') {
      if (!inInventory) {
        appendLine('You need the flux core before you can stabilize the ship.', 'warning');
        return false;
      }
      state.gameWon = true;
      state.inventory = state.inventory.filter((item) => item.toLowerCase() !== 'flux core');
      const ending = getMissionEnding();
      statusText();
      appendLine('You slot the flux core into the nav console. The reactor catches and the ship comes back online.', 'system');
      appendLine(`${ending.title}: ${ending.description}`, 'success');
      updateMapDisplay();
      return true;
    }

    if (state.currentRoom === 'airlock' && normalized === 'oxygen key') {
      if (!inInventory) {
        appendLine('You do not have an oxygen key.', 'warning');
        return false;
      }
      appendLine('You unlock the emergency supply locker with the oxygen key. Inside, you find ration packs and technical manuals.', 'system');
      appendLine("They won't help you leave, but they confirm others were here before.", 'info');
      return true;
    }

    if (state.currentRoom === 'dockingBay' && normalized === 'fuel cell') {
      if (!inInventory) {
        appendLine('You do not have a fuel cell.', 'warning');
        return false;
      }
      appendLine("You insert the fuel cell into the shuttle's auxiliary power port. The shuttle's lights flicker to life.", 'system');
      appendLine('It is not enough to launch, but you can access the flight logs now. The last entry reads: "Reactor critical. All hands to emergency stations."', 'info');
      return true;
    }

    if (state.currentRoom === 'observationDeck' && normalized === 'medkit') {
      if (!inInventory) {
        appendLine('You do not have a medkit.', 'warning');
        return false;
      }
      if (state.crewSaved) {
        appendLine('There is no one left to help here.', 'info');
        return false;
      }
      appendLine("You respond to the distress signal. Dr. Chen's voice crackles through the comm, weakened but alive.", 'system');
      appendLine('"Thank... thank you. I am in the med bay. The reactor overload... I managed to seal it. Flux core is... in the core chamber."', 'info');
      appendLine('You have saved a crew member and learned the reactor location. The mission suddenly feels less lonely.', 'system');
      appendLine('Dr. Chen guides you through the debris field, clearing the extra oxygen cost here.', 'success');
      state.crewSaved = true;
      state.oxygenTurns += SIDE_QUEST_OXYGEN_REWARD;
      appendLine(`Dr. Chen shares emergency oxygen: +${SIDE_QUEST_OXYGEN_REWARD} actions.`, 'success');
      updateMapDisplay();
      return true;
    }

    if (state.currentRoom === 'maintenanceCorridor' && normalized === 'repair patch') {
      if (!inInventory) {
        appendLine('You do not have a repair patch.', 'warning');
        return false;
      }
      if (state.systemsRepaired) {
        appendLine("The systems are already repaired. There's nothing more to fix here.", 'info');
        return false;
      }
      appendLine('You apply the repair patch to the damaged power conduit. Sparks stop flying and the panel stabilizes.', 'system');
      appendLine("The ship's secondary systems come back online. Life support is now at 87%.", 'info');
      state.systemsRepaired = true;
      state.oxygenTurns += SIDE_QUEST_OXYGEN_REWARD;
      appendLine(`Restored life support expands your oxygen reserve: +${SIDE_QUEST_OXYGEN_REWARD} actions.`, 'success');
      updateMapDisplay();
      return true;
    }

    if (inInventory) {
      appendLine(`You try to use the ${itemName}, but there's nothing here to use it on.`, 'info');
      return false;
    }

    appendLine(`You do not have a ${itemName}.`, 'warning');
    return false;
  }

  function handleMove(direction) {
    const room = rooms[state.currentRoom];
    const target = room.exits[direction];
    if (!target) {
      appendLine(`You cannot go ${direction} from here.`, 'warning');
      return false;
    }
    state.currentRoom = target;
    appendLine(`You move ${direction}.`, 'system');
    if (target === 'maintenanceCorridor' && !state.systemsRepaired) {
      appendLine('Warning: a pressure leak is draining oxygen fast. Actions in Maintenance cost 2 oxygen until repaired.', 'warning');
    }
    if (target === 'observationDeck' && !state.crewSaved) {
      appendLine('Warning: asteroid debris is striking the observation windows. Actions here cost 2 oxygen until Dr. Chen guides you through the impact zone.', 'warning');
    }
    renderRoom();
    return true;
  }

  function handleHelp() {
    appendLine('Commands: look, inventory, take <item>, use <item>, go <direction>, examine <subject>, flight, travel to <destination>, board, land, explore, mine, trade, craft <item>, ship, status, help, save, load, reset, map.', 'system');
  }

  function handleExamine(subject) {
    if (!subject) {
      appendLine('Examine what?', 'warning');
      return false;
    }
    const normalized = subject.toLowerCase();
    if (state.currentRoom === 'observationDeck' && ['beacon', 'monitor', 'signal'].includes(normalized)) {
      appendLine('The distress beacon pulses with an intermittent signal. You pick up a voice transmission.', 'system');
      appendLine('"...Deep Drift to any listening... Dr. Chen, medical officer. Reactor critical. Need... need help."', 'info');
      appendLine('The beacon is still active. Someone is waiting for you.', 'system');
      return true;
    }
    if (state.currentRoom === 'crewQuarters' && ['roster', 'panel', 'names'].includes(normalized)) {
      appendLine('The wall panel shows the crew manifest. Most entries have been scratched or marked "DECEASED".', 'system');
      appendLine('Only one name remains: "Dr. Sarah Chen - Medical Officer - Last Known Location: Medical Bay".', 'info');
      return true;
    }
    if (state.currentRoom === 'dockingBay' && ['shuttle', 'shuttle logs'].includes(normalized)) {
      appendLine('The shuttle is pristine but disabled. Its flight computer might have logs...', 'system');
      appendLine(state.inventory.some((item) => item.toLowerCase() === 'fuel cell')
        ? 'If only you had power... A fuel cell might work.'
        : "You'll need a fuel cell to power it up.", 'info');
      return true;
    }
    if (state.currentRoom === 'commandDeck' && ['console', 'nav console', 'display'].includes(normalized)) {
      appendLine('The navigation console is dark. Its status display flickers weakly, showing: "REACTOR OFFLINE - CRITICAL ERROR".', 'system');
      appendLine("It will need the reactor's flux core to restart the ship.", 'info');
      return true;
    }
    if (state.currentRoom === 'reactorCore' && ['core', 'light', 'chamber'].includes(normalized)) {
      appendLine('The reactor core glows with an unstable hum. At its center, a crystalline flux core sits mounted in a harness.', 'system');
      appendLine('It looks like exactly what the command deck needs.', 'info');
      return true;
    }
    appendLine('You see nothing special about that.', 'info');
    return false;
  }

  function handleMap() {
    appendLine('Voyage Data:', 'system');
    appendLine('Deep Drift, still under repair; local route network is active.', 'info');
  }

  function handleFlight() {
    if (state.currentRoom !== 'commandDeck') {
      appendLine('You need to be on the command deck to access the flight console.', 'warning');
      return false;
    }
    appendLine('Flight Console — route table', 'system');
    state.phase2.destinations.forEach((destination, idx) => {
      appendLine(`${idx + 1}. ${destination.name} | ${destination.type} | fuel ${destination.fuelCost} | eta ${destination.travelTime}s | hazard ${destination.hazard}`, 'info');
    });
    appendLine('Launch a route with: travel to <destination name>', 'system');
    return true;
  }

  function handleShipStatus() {
    appendLine('Ship Status', 'system');
    appendLine(`Hull: ${state.ship.hull} | Shields: ${state.ship.shields} | Fuel: ${state.ship.fuel} | Credits: ${state.ship.credits} | Minerals: ${state.ship.minerals}`, 'info');
    appendLine(`Modules: ${state.ship.modules.join(', ') || 'none'}`, 'info');
    if (state.phase2.currentDestination) {
      appendLine(`Current destination: ${state.phase2.currentDestination.name} (${state.phase2.currentDestination.type})`, 'success');
    } else {
      appendLine('Current destination: docked in orbit', 'info');
    }
  }

  function handleTrade(args) {
    const destination = state.phase2.currentDestination;
    if (state.phase2.locationStatus !== 'landed' || !destination || !['station', 'planet'].includes(destination.type)) {
      appendLine('You need to arrive at a station or planet before trading.', 'warning');
      return false;
    }
    const command = (args || '').trim().toLowerCase();
    if (!command || command === 'list') {
      appendLine('Trade menu: buy fuel | sell minerals | buy supplies', 'system');
      return true;
    }

    if (command === 'buy fuel') {
      if (state.ship.credits < 12) {
        appendLine('You do not have enough credits for fuel.', 'warning');
        return false;
      }
      state.ship.credits -= 12;
      state.ship.fuel = Math.min(130, state.ship.fuel + 18);
      appendLine('You buy a fuel reserve and top up your ship tanks.', 'success');
      return true;
    }

    if (command === 'sell minerals') {
      if (state.ship.minerals <= 0) {
        appendLine('You have no minerals to sell.', 'warning');
        return false;
      }
      const payout = state.ship.minerals * 4;
      state.ship.minerals = 0;
      state.ship.credits += payout;
      appendLine(`You sell your minerals for ${payout} credits.`, 'success');
      return true;
    }

    if (command === 'buy supplies') {
      if (state.ship.credits < 10) {
        appendLine('You cannot afford the supplies here.', 'warning');
        return false;
      }
      state.ship.credits -= 10;
      state.ship.modules.push('survival_pack');
      appendLine('You buy essential survival packs and field tools.', 'success');
      return true;
    }

    appendLine('That trade action is not available here.', 'warning');
    return false;
  }

  function handleMine() {
    const destination = state.phase2.currentDestination;
    if (state.phase2.locationStatus !== 'landed' || !destination) {
      appendLine('You need to be on a destination site before you can mine.', 'warning');
      return false;
    }
    if (!['asteroid', 'planet'].includes(destination.type)) {
      appendLine('There are no useful ore veins here to mine.', 'warning');
      return false;
    }
    const gain = destination.type === 'asteroid' ? 5 : 3;
    state.ship.minerals += gain;
    appendLine(`You mine ${gain} units of ore and mineral fragments.`, 'success');
    return true;
  }

  function handleExplore() {
    const destination = state.phase2.currentDestination;
    if (state.phase2.locationStatus !== 'landed' || !destination) {
      appendLine('You need to be on a destination site before you can explore.', 'warning');
      return false;
    }
    if (destination.type === 'planet') {
      const sample = destination.biome === 'forest' ? 'biotic sample' : destination.biome === 'cave' ? 'crystal shard' : 'deep-ocean specimen';
      state.inventory.push(sample);
      appendLine(`You explore the ${destination.biome} terrain and recover a ${sample}.`, 'success');
      return true;
    }
    if (destination.type === 'station') {
      appendLine('You inspect the station arcades, docks, and trade floors. The market is active and the crew are alert.', 'info');
      return true;
    }
    appendLine('You sweep the asteroid field and recover old salvage fragments.', 'info');
    return true;
  }

  function handleCraft(args) {
    const recipeId = (args || '').trim().toLowerCase();
    if (!recipeId) {
      appendLine('Craft what? Available recipes: fuel_cell, alloy_patch', 'system');
      return false;
    }
    const result = craftItem(state, recipeId);
    if (!result.success) {
      appendLine(result.reason, 'warning');
      return false;
    }
    appendLine(result.message, 'success');
    appendLine(`Ship status: fuel ${state.ship.fuel} | minerals ${state.ship.minerals} | hull ${state.ship.hull}`, 'info');
    return true;
  }

  function handleFlightRoute(input) {
    const routeName = normalizeTravelDestination(input);
    if (!routeName) {
      appendLine('Specify a destination name to travel to.', 'warning');
      return false;
    }
    const destination = state.phase2.destinations.find((item) => item.name.toLowerCase() === routeName.toLowerCase() || item.id.toLowerCase() === routeName.toLowerCase());
    if (!destination) {
      appendLine(`No route matches ${routeName}. Use the flight console list to choose a destination.`, 'warning');
      return false;
    }

    const started = startFlight(state, destination.id, (arrivedDestination) => {
      appendLine(`Arrival confirmed: ${arrivedDestination.name}. You are now at the ${arrivedDestination.type} site.`, 'system');
      appendLine(`Hazard: ${arrivedDestination.hazard}. Reward: ${arrivedDestination.reward}.`, 'info');
      renderRoom();
    });
    if (!started.traveling) {
      appendLine(started.reason, 'warning');
      return false;
    }

    appendLine(`Departure initiated. ${destination.name} is now in transit. Estimated arrival: ${destination.travelTime} seconds.`, 'system');
    appendLine('While in transit, you can craft or inspect the ship.', 'info');
    return true;
  }

  function handleBoardShip() {
    if (state.phase2.locationStatus !== 'landed' || !state.phase2.currentDestination) {
      appendLine('You are already aboard the ship.', 'info');
      return false;
    }
    const destination = state.phase2.currentDestination;
    state.phase2.locationStatus = 'orbit';
    state.phase2.activeZone = null;
    state.currentRoom = 'commandDeck';
    appendLine(`You board the ship and return to orbit above ${destination.name}.`, 'success');
    renderRoom();
    return true;
  }

  function handleLand() {
    const destination = state.phase2.currentDestination;
    if (state.phase2.locationStatus !== 'orbit' || !destination) {
      appendLine('You must be aboard the ship at a destination to land.', 'warning');
      return false;
    }
    state.phase2.locationStatus = 'landed';
    state.phase2.activeZone = destination.type === 'planet' ? destination.biome : 'landing bay';
    appendLine(`You land at the ${destination.type} site at ${destination.name}.`, 'success');
    renderRoom();
    return true;
  }

  function parseCommand(rawInput) {
    const input = rawInput.trim();
    if (!input) return;

    appendLine(`> ${input}`, 'command');
    const tokens = input.split(/\s+/);
    const command = tokens[0].toLowerCase();
    const rest = tokens.slice(1).join(' ');

    const freeCommands = ['look', 'l', 'inventory', 'inv', 'help', '?', 'map', 'save', 'load', 'reset', 'status', 'ship'];
    const consumesOxygen = ['take', 'use', 'go', 'move', 'n', 's', 'e', 'w', 'north', 'south', 'east', 'west', 'examine', 'x', 'read', 'mine', 'explore', 'trade'].includes(command);
    const leakSurcharge = state.currentRoom === 'maintenanceCorridor' && !state.systemsRepaired ? 1 : 0;
    const debrisSurcharge = state.currentRoom === 'observationDeck' && !state.crewSaved ? 1 : 0;

    if (state.gameOver && consumesOxygen) {
      appendLine('Oxygen is depleted. Use "reset" to try again or "load" to restore a save.', 'warning');
      return;
    }

    let actionSucceeded = false;
    switch (command) {
      case 'look':
      case 'l':
        roomDescription();
        break;
      case 'inventory':
      case 'inv':
        appendLine(`Inventory: ${state.inventory.length ? state.inventory.join(', ') : 'empty'}.`, 'system');
        break;
      case 'take':
        actionSucceeded = handleTake(rest);
        break;
      case 'use':
        actionSucceeded = handleUse(rest);
        break;
      case 'go':
      case 'move':
        actionSucceeded = handleMove(rest.toLowerCase());
        break;
      case 'n':
      case 's':
      case 'e':
      case 'w':
      case 'north':
      case 'south':
      case 'east':
      case 'west':
        actionSucceeded = handleMove(command.length === 1 ? { n: 'north', s: 'south', e: 'east', w: 'west' }[command] : command);
        break;
      case 'examine':
      case 'x':
      case 'read':
        actionSucceeded = handleExamine(rest);
        break;
      case 'help':
      case '?':
        handleHelp();
        break;
      case 'save':
        localStorage.setItem('deep-drift-save', JSON.stringify({
          currentRoom: state.currentRoom,
          inventory: state.inventory,
          visited: [...state.visited],
          oxygenTurns: state.oxygenTurns,
          gameWon: state.gameWon,
          gameOver: state.gameOver,
          crewSaved: state.crewSaved,
          systemsRepaired: state.systemsRepaired,
          ship: state.ship,
          phase2: state.phase2,
          roomItems: Object.fromEntries(Object.entries(rooms).map(([roomId, room]) => [roomId, room.items])),
        }));
        appendLine('Progress saved.', 'system');
        break;
      case 'load':
        try {
          const saved = JSON.parse(localStorage.getItem('deep-drift-save') || '{}');
          state.currentRoom = saved.currentRoom || 'airlock';
          state.inventory = saved.inventory || [];
          state.visited = new Set(saved.visited || ['airlock']);
          state.oxygenTurns = saved.oxygenTurns ?? MAX_OXYGEN_TURNS;
          state.gameWon = Boolean(saved.gameWon);
          state.gameOver = Boolean(saved.gameOver);
          state.crewSaved = Boolean(saved.crewSaved);
          state.systemsRepaired = Boolean(saved.systemsRepaired);
          state.ship = saved.ship || state.ship;
          state.phase2 = saved.phase2 || state.phase2;
          Object.entries(rooms).forEach(([roomId, room]) => {
            const savedItems = saved.roomItems && saved.roomItems[roomId];
            room.items = Array.isArray(savedItems)
              ? [...savedItems]
              : initialRoomItems[roomId].filter((item) => !state.inventory.some((ownedItem) => ownedItem.toLowerCase() === item.toLowerCase()));
          });
          appendLine('Saved progress restored.', 'system');
          renderRoom();
        } catch (error) {
          appendLine('Could not load saved game.', 'warning');
        }
        break;
      case 'reset':
        state.currentRoom = 'airlock';
        Object.entries(rooms).forEach(([roomId, room]) => {
          room.items = [...initialRoomItems[roomId]];
        });
        state.inventory = [];
        state.visited = new Set(['airlock']);
        state.oxygenTurns = MAX_OXYGEN_TURNS;
        state.gameWon = false;
        state.gameOver = false;
        state.crewSaved = false;
        state.systemsRepaired = false;
        state.ship = { hull: 100, fuel: 90, shields: 40, credits: 45, minerals: 6, cargo: [], cargoLimit: 18, modules: ['nav_console', 'basic_scanner'], upgrades: { engine: 1, mining: 1, shield: 1 } };
        state.phase2 = createPhase2State().phase2;
        appendLine('A fresh mission begins.', 'system');
        renderRoom();
        break;
      case 'map':
        handleMap();
        break;
      case 'flight':
      case 'destinations':
        actionSucceeded = handleFlight();
        break;
      case 'status':
      case 'ship':
        handleShipStatus();
        break;
      case 'craft':
        actionSucceeded = handleCraft(rest);
        break;
      case 'mine':
        actionSucceeded = handleMine();
        break;
      case 'explore':
        actionSucceeded = handleExplore();
        break;
      case 'trade':
        actionSucceeded = handleTrade(rest);
        break;
      case 'travel':
        actionSucceeded = handleFlightRoute(rest);
        break;
      case 'board':
      case 'return':
        actionSucceeded = handleBoardShip();
        break;
      case 'land':
      case 'disembark':
        actionSucceeded = handleLand();
        break;
      default:
        if (/^travel\s+to\b/i.test(input)) {
          actionSucceeded = handleFlightRoute(input.replace(/^travel\s+to\s+/i, ''));
        } else {
          appendLine(`Unknown command: ${input}. Type "help" for a list of actions.`, 'warning');
        }
    }

    if (consumesOxygen && actionSucceeded) {
      const oxygenCost = 1 + leakSurcharge + debrisSurcharge;
      state.oxygenTurns = Math.max(0, state.oxygenTurns - oxygenCost);
      statusText();
      appendLine(`Oxygen spent: ${oxygenCost}. Reserve: ${state.oxygenTurns}/${oxygenCapacity()}.`, state.oxygenTurns <= 3 ? 'warning' : 'system');
      if (state.oxygenTurns === 0 && !state.gameWon) {
        state.gameOver = true;
        statusText();
        appendLine('Oxygen depleted. The mission has failed. Use "reset" to try again or "load" to restore a save.', 'warning');
      }
    }

    updateRoomActions();
  }

  function startGame() {
    document.body.classList.add('game-started');
    if (introScreen) introScreen.hidden = true;
    if (gameShell) {
      gameShell.hidden = false;
      gameShell.style.display = 'block';
    }
    if (inputEl) inputEl.focus();
  }

  if (startGameBtn) startGameBtn.addEventListener('click', startGame);
  if (introScreen) introScreen.hidden = false;
  if (gameShell) {
    gameShell.hidden = true;
    gameShell.style.display = 'none';
  }

  if (mapPanelEl) mapPanelEl.open = !mapPanelUsesMobileLayout;
  window.addEventListener('resize', syncMapPanelToViewport);
  if (mobileLayoutQuery && typeof mobileLayoutQuery.addEventListener === 'function') {
    mobileLayoutQuery.addEventListener('change', syncMapPanelToViewport);
  }

  initStarfield();
  appendLine('Deep Drift online. Welcome aboard the research vessel.', 'system');
  appendLine('Your mission: restore the ship and return to stable orbit.', 'system');
  appendLine(`Oxygen reserve: ${MAX_OXYGEN_TURNS} actions. Movement and interactions consume oxygen; look, inventory, help, map, save, and load are free.`, 'warning');
  appendLine('Start by taking the oxygen key, then head north toward the Docking Bay. Type "help" for more commands.', 'system');
  renderRoom();

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    parseCommand(inputEl.value);
    inputEl.value = '';
    inputEl.focus();
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    generateGalaxy,
    createPhase2State,
    startFlight,
    resolveTravel,
    craftItem,
    normalizeTravelDestination,
    rooms,
  };
}
