const hasDocument = typeof document !== 'undefined';
const gameWorld = typeof module !== 'undefined' && module.exports
  ? require('./game-world.js')
  : globalThis.DeepDriftWorld;
const spaceSystems = typeof module !== 'undefined' && module.exports
  ? require('./space-systems.js')
  : globalThis.DeepDriftSpace;
const phaseOneCommandModule = typeof module !== 'undefined' && module.exports
  ? require('./phase1-commands.js')
  : globalThis.DeepDriftPhaseOne;
const spaceCommandModule = typeof module !== 'undefined' && module.exports
  ? require('./space-commands.js')
  : globalThis.DeepDriftSpaceCommands;
const {
  rooms,
  initialRoomItems,
  MAX_OXYGEN_TURNS,
  SIDE_QUEST_OXYGEN_REWARD,
  OXYGEN_RECHARGE_INTERVAL_MS,
  rechargeOxygen,
} = gameWorld;
const {
  generateGalaxy,
  createPhase2State,
  startFlight,
  resolveTravel,
  routeFuelCost,
  craftItem,
  fuelCapacity,
  hullCapacity,
  createProgressionState,
  awardProgress,
  normalizeTravelDestination,
  UPGRADE_DEFINITIONS,
  upgradeShipSystem,
  routeTravelTime,
  discoverNewDestinations
} = spaceSystems;
const { createPhaseOneCommands } = phaseOneCommandModule;
const { createSpaceCommands } = spaceCommandModule;

const initialPhase2State = createPhase2State();
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
  ship: initialPhase2State.ship,
  phase2: initialPhase2State.phase2,
  progression: createProgressionState(),
};

state.destinations = initialPhase2State.destinations;

if (hasDocument) {
  const introScreen = document.getElementById('intro-screen');
  const gameShell = document.getElementById('game-shell');
  const startGameBtn = document.getElementById('start-game-btn');
  const outputEl = document.getElementById('game-output');
  const formEl = document.getElementById('command-form');
  const inputEl = document.getElementById('command-input');
  const statusEl = document.getElementById('status-pill');
  const phase2LaunchBtn = document.getElementById('phase2-launch-btn');
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
    const frontierBadge = state.progression && state.progression.rank ? ` | ${state.progression.rank}` : '';
    statusEl.textContent = state.gameWon ? 'Mission Complete' : state.gameOver ? 'No Oxygen' : `O2 ${state.oxygenTurns}/${oxygenCapacity()}${frontierBadge}`;
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
      { item: 'emergency rations', location: 'Crew Quarters' },
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
    if (phase2LaunchBtn) phase2LaunchBtn.hidden = !state.gameWon;
    if (state.gameOver) {
      const destination = state.phase2.currentDestination;
      const cargoHasRations = (state.ship.cargo || []).some((item) => item.toLowerCase() === 'survival pack' || item.toLowerCase() === 'emergency rations');
      const inventoryHasRations = state.inventory.some((item) => item.toLowerCase() === 'emergency rations');
      if (state.ship.supplies > 0 || cargoHasRations || inventoryHasRations) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'room-action-button';
        const command = state.ship.supplies > 0 ? 'use survival pack' : 'use emergency rations';
        button.textContent = state.ship.supplies > 0 ? 'Use Survival Pack' : 'Use Emergency Rations';
        button.addEventListener('click', () => parseCommand(command));
        roomActionsEl.appendChild(button);
      }
      if (state.phase2.locationStatus === 'landed' && destination && ['station', 'planet'].includes(destination.type)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'room-action-button';
        button.textContent = 'Buy Oxygen';
        button.addEventListener('click', () => parseCommand('trade buy oxygen'));
        roomActionsEl.appendChild(button);
      }
      return;
    }

    const actions = rooms[state.currentRoom].items.map((item) => ({ label: `Take ${item}`, command: `take ${item}` }));
    if (state.currentRoom === 'commandDeck') {
      actions.push({ label: state.gameWon ? 'Launch Phase 2' : 'Flight Console', command: 'flight' });
      actions.push({ label: 'Ship Status', command: 'ship' });
      actions.push({ label: 'Ship Modules', command: 'modules' });
    }
    if (state.ship.supplies > 0) {
      actions.push({ label: 'Use Survival Pack', command: 'use survival pack' });
    } else if ((state.ship.cargo || []).some((item) => item.toLowerCase() === 'survival pack' || item.toLowerCase() === 'emergency rations')) {
      actions.push({ label: 'Use Emergency Rations', command: 'use emergency rations' });
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
      crewQuarters: 'emergency rations',
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
      if (['station', 'planet'].includes(state.phase2.currentDestination.type)) {
        actions.push({ label: 'Buy Oxygen', command: 'trade buy oxygen' });
      }
      actions.push({ label: 'Board Ship', command: 'board' });
    } else if (state.phase2.currentDestination && state.phase2.locationStatus === 'orbit') {
      actions.push({ label: 'Land at Site', command: 'land' });
    }
    if (state.phase2.travelling) {
      actions.push({ label: 'Craft', command: 'craft fuel_cell' });
      actions.push({ label: 'Ship Status', command: 'ship' });
      actions.push({ label: 'Inspect Modules', command: 'modules' });
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
      const routeStatus = !state.gameWon
        ? 'The reactor is offline. Restore the flux core to repair the ship and unlock Phase 2 travel.'
        : state.phase2.travelling
        ? `The ship is already in transit to ${state.phase2.currentDestination ? state.phase2.currentDestination.name : 'its destination'}.`
        : 'The route network is ready. Type "flight" to view destinations or "travel to <name>" to launch.';
      appendLine(`Command deck flight interface active. ${routeStatus}`, 'system');
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

  function handleMap() {
    appendLine('Voyage Data:', 'system');
    appendLine('Deep Drift, still under repair; local route network is active.', 'info');
  }

  const spaceCommands = createSpaceCommands({
    state,
    appendLine,
    renderRoom,
    statusText,
    oxygenCapacity,
    startFlight,
    craftItem,
    fuelCapacity,
    hullCapacity,
    routeFuelCost,
    routeTravelTime,
    normalizeTravelDestination,
    discoverNewDestinations,
    upgradeShipSystem,
    UPGRADE_DEFINITIONS,
    awardProgress,
  });
  const phaseOneCommands = createPhaseOneCommands({
    state,
    rooms,
    appendLine,
    updateMapDisplay,
    statusText,
    renderRoom,
    fuelCapacity,
    hullCapacity,
    awardProgress,
    oxygenCapacity,
    handleFlight: spaceCommands.handleFlight,
    handleScan: spaceCommands.handleScan,
  });
  const {
    handleTake,
    handleDrop,
    handleSalvage,
    handleUse,
    handleMove,
    handleHelp,
    handleExamine,
  } = phaseOneCommands;
  const {
    handleFlight,
    handleShipStatus,
    handleModules,
    handleCargo,
    handleMinerals,
    handleUpgrades,
    handleScan,
    handleTrade,
    handleMine,
    handleExplore,
    handleCraft,
    handleFlightRoute,
    handleBoardShip,
    handleLand,
  } = spaceCommands;

  function parseCommand(rawInput) {
    const input = rawInput.trim();
    if (!input) return;

    appendLine(`> ${input}`, 'command');
    const tokens = input.split(/\s+/);
    const command = tokens[0].toLowerCase();
    const rest = tokens.slice(1).join(' ');

    const freeCommands = ['look', 'l', 'inventory', 'inv', 'help', '?', 'map', 'save', 'load', 'reset', 'status', 'ship', 'modules'];
    const isOxygenPurchase = (command === 'trade' && rest.trim().toLowerCase() === 'buy oxygen')
      || (command === 'use' && ['survival pack', 'survival_pack', 'emergency rations'].includes(rest.trim().toLowerCase()));
    const isTradeListing = command === 'trade' && ['list', ''].includes(rest.trim().toLowerCase());
    const isModuleInspection = ['inspect', 'examine'].includes(command) && rest.trim().toLowerCase() === 'modules';
    const consumesOxygen = !isOxygenPurchase && !isTradeListing && !isModuleInspection && !freeCommands.includes(command) && ['take', 'use', 'go', 'move', 'n', 's', 'e', 'w', 'north', 'south', 'east', 'west', 'examine', 'x', 'read', 'mine', 'explore', 'trade'].includes(command);
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
        actionSucceeded = rest.trim().toLowerCase() === 'modules' ? handleModules() : handleExamine(rest);
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
          progression: state.progression,
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
          state.progression = saved.progression || createProgressionState();
          state.destinations = state.phase2.destinations || state.destinations;
          const currentDestinationId = state.phase2.currentDestination && state.phase2.currentDestination.id;
          state.phase2.currentDestination = state.destinations.find((destination) => destination.id === currentDestinationId) || null;
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
        const freshPhase2State = createPhase2State();
        state.ship = freshPhase2State.ship;
        state.phase2 = freshPhase2State.phase2;
        state.progression = createProgressionState();
        state.destinations = freshPhase2State.destinations;
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
      case 'modules':
        handleModules();
        break;
      case 'inspect':
        actionSucceeded = rest.trim().toLowerCase() === 'modules' ? handleModules() : handleExamine(rest);
        break;
      case 'progress':
      case 'rank':
        appendLine(`Frontier status: ${state.progression.rank} | Reputation: ${state.progression.reputation} | Routes completed: ${state.progression.routesCompleted}`, 'system');
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
      case 'cargo':
        actionSucceeded = handleCargo();
        break;
      case 'minerals':
        actionSucceeded = handleMinerals();
        break;
      case 'scan':
      case 'survey':
        actionSucceeded = handleScan();
        break;
      case 'upgrade':
      case 'upgrades':
        actionSucceeded = handleUpgrades(rest);
        break;
      case 'drop':
        actionSucceeded = handleDrop(rest);
        break;
      case 'salvage':
        actionSucceeded = handleSalvage(rest);
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
        appendLine(`Oxygen depleted. Actions are paused; the reserve restores 1 action every ${OXYGEN_RECHARGE_INTERVAL_MS / 1000} seconds.`, 'warning');
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
  if (phase2LaunchBtn) phase2LaunchBtn.addEventListener('click', () => parseCommand('flight'));
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

  setInterval(() => {
    const wasGameOver = state.gameOver;
    if (!rechargeOxygen(state)) return;
    statusText();
    if (wasGameOver && !state.gameOver) {
      appendLine('Emergency oxygen restored. You can continue.', 'success');
    }
    updateRoomActions();
  }, OXYGEN_RECHARGE_INTERVAL_MS);

  initStarfield();
  appendLine('Deep Drift online. Welcome aboard the research vessel.', 'system');
  appendLine('Your mission: restore the ship and return to stable orbit.', 'system');
  appendLine(`Oxygen reserve: ${MAX_OXYGEN_TURNS} actions. It recharges by 1 every ${OXYGEN_RECHARGE_INTERVAL_MS / 1000} seconds, up to your capacity.`, 'warning');
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
