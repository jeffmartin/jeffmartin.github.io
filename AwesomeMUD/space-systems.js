(function (root, factory) {
  const spaceSystems = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = spaceSystems;
  } else {
    root.DeepDriftSpace = spaceSystems;
  }
})(globalThis, function () {
  const CRAFTING_RECIPES = {
    fuel_cell: {
      name: 'Fuel Cell',
      requires: { minerals: 4 },
      operate: (ship) => {
        ship.modules = ship.modules || [];
        if (!ship.modules.includes('fuel_cell')) ship.modules.push('fuel_cell');
        ship.fuel = Math.min(fuelCapacity(ship), ship.fuel + 24);
      },
    },
    alloy_patch: {
      name: 'Alloy Patch',
      requires: { minerals: 3 },
      operate: (ship) => {
        ship.modules = ship.modules || [];
        if (!ship.modules.includes('alloy_patch')) ship.modules.push('alloy_patch');
        ship.hull = Math.min(hullCapacity(ship), ship.hull + 12);
      },
    },
    mining_laser: {
      name: 'Mining Laser Booster',
      requires: { minerals: 5 },
      operate: (ship) => {
        ship.modules = ship.modules || [];
        if (!ship.modules.includes('mining_laser')) ship.modules.push('mining_laser');
        ship.upgrades = ship.upgrades || {};
        ship.upgrades.mining = (ship.upgrades.mining || 1) + 1;
      },
    },
    deep_scanner: {
      name: 'Deep Scanner Array',
      requires: { minerals: 4 },
      operate: (ship) => {
        ship.modules = ship.modules || [];
        if (!ship.modules.includes('deep_scanner')) ship.modules.push('deep_scanner');
      },
    },
    shield_capacitor: {
      name: 'Shield Capacitor',
      requires: { minerals: 5 },
      operate: (ship) => {
        ship.modules = ship.modules || [];
        if (!ship.modules.includes('shield_capacitor')) ship.modules.push('shield_capacitor');
        ship.shields = (ship.shields || 40) + 20;
      },
    },
  };

  const UPGRADE_DEFINITIONS = {
    engine: {
      name: 'Hyper-Engine Tuning',
      description: 'Reduces fuel burn on all routes by 2 per level.',
      getCost: (level) => ({ minerals: 3 + level * 2, credits: 15 + level * 10 }),
      apply: (ship) => {
        ship.upgrades = ship.upgrades || {};
        ship.upgrades.engine = (ship.upgrades.engine || 1) + 1;
      },
    },
    mining: {
      name: 'Extraction Beam Calibrator',
      description: 'Increases mineral yield from ore seams and planet deposits by +1.',
      getCost: (level) => ({ minerals: 3 + level * 2, credits: 10 + level * 10 }),
      apply: (ship) => {
        ship.upgrades = ship.upgrades || {};
        ship.upgrades.mining = (ship.upgrades.mining || 1) + 1;
      },
    },
    shield: {
      name: 'Deflector Shield Array',
      description: 'Reinforces deflector shields (+15) and hull absorption.',
      getCost: (level) => ({ minerals: 4 + level * 2, credits: 20 + level * 10 }),
      apply: (ship) => {
        ship.upgrades = ship.upgrades || {};
        ship.upgrades.shield = (ship.upgrades.shield || 1) + 1;
        ship.shields = (ship.shields || 40) + 15;
      },
    },
    cargo: {
      name: 'Cargo Hold Expansion',
      description: 'Expands ship cargo capacity by +6 slots.',
      getCost: (level) => ({ minerals: 3 + level * 2, credits: 15 + level * 10 }),
      apply: (ship) => {
        ship.upgrades = ship.upgrades || {};
        ship.upgrades.cargo = (ship.upgrades.cargo || 1) + 1;
        ship.cargoLimit = (ship.cargoLimit || 18) + 6;
      },
    },
  };

  function upgradeShipSystem(state, systemKey) {
    if (!state.ship) return { success: false, reason: 'Ship data unavailable.' };
    const key = (systemKey || '').trim().toLowerCase();
    const upgrade = UPGRADE_DEFINITIONS[key];
    if (!upgrade) {
      const available = Object.keys(UPGRADE_DEFINITIONS).join(', ');
      return { success: false, reason: 'Unknown upgrade "' + systemKey + '". Available systems: ' + available + '.' };
    }
    const currentLevel = ((state.ship.upgrades || {})[key]) || 1;
    const cost = upgrade.getCost(currentLevel);
    if ((state.ship.minerals || 0) < cost.minerals) {
      return { success: false, reason: 'Not enough minerals for ' + upgrade.name + ' (requires ' + cost.minerals + ' minerals, have ' + (state.ship.minerals || 0) + ').' };
    }
    if ((state.ship.credits || 0) < cost.credits) {
      return { success: false, reason: 'Not enough credits for ' + upgrade.name + ' (requires ' + cost.credits + ' credits, have ' + (state.ship.credits || 0) + ').' };
    }
    state.ship.minerals -= cost.minerals;
    state.ship.credits -= cost.credits;
    upgrade.apply(state.ship);
    const newLevel = ((state.ship.upgrades || {})[key]) || (currentLevel + 1);
    return {
      success: true,
      system: key,
      level: newLevel,
      message: upgrade.name + ' upgraded to level ' + newLevel + '! ' + upgrade.description,
    };
  };

  function fuelCapacity(ship) {
    return 130 + ((ship.modules || []).includes('fuel_cell') ? 20 : 0);
  }

  function hullCapacity(ship) {
    return 110 + ((ship.modules || []).includes('alloy_patch') ? 20 : 0);
  }

  function createSeededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    return Math.floor(Math.random() * 4294967296) >>> 0;
  }

  // ── Position helpers ──────────────────────────────────────────────────────
  const HOME_POSITION = { x: 0, y: 0 };

  function getPlayerPosition(state) {
    const dest = state.phase2 && state.phase2.currentDestination;
    if (!dest || dest.x === undefined) return HOME_POSITION;
    return { x: dest.x, y: dest.y };
  }

  function fuelFromDistance(dist) {
    return Math.max(3, Math.round(dist * 0.25 + 6));
  }

  function timeFromDistance(dist, typeBonus) {
    return Math.max(10, Math.round(dist * 0.5 + 10 + (typeBonus || 0)));
  }

  function randomInteger(random, min, max) {
    return min + Math.floor(random() * (max - min + 1));
  }

  function createAsteroidSite(seed) {
    const random = createSeededRandom(seed);
    const oreNames = ['silicate seam', 'nickel vein', 'ice-rich fracture', 'cobalt shelf'];
    const salvageNames = ['sealed survey pod', 'abandoned cargo case', 'damaged probe'];
    const locations = [
      { id: 'ore-a', kind: 'ore', name: oreNames[randomInteger(random, 0, oreNames.length - 1)], mineralsRemaining: randomInteger(random, 3, 6), revealed: false },
      { id: 'salvage', kind: 'salvage', name: salvageNames[randomInteger(random, 0, salvageNames.length - 1)], credits: randomInteger(random, 5, 14), revealed: false, collected: false },
      { id: 'ore-b', kind: 'ore', name: oreNames[randomInteger(random, 0, oreNames.length - 1)], mineralsRemaining: randomInteger(random, 2, 5), revealed: false },
    ];

    for (let index = locations.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInteger(random, 0, index);
      [locations[index], locations[swapIndex]] = [locations[swapIndex], locations[index]];
    }

    return { seed, locations };
  }

  function createPlanetSite(seed, biome) {
    const random = createSeededRandom(seed);
    const resources = [
      {
        id: 'resource-1',
        kind: 'ore',
        name: biome === 'forest' ? 'iron-rich root bed' : biome === 'cave' ? 'crystal seam' : biome === 'ocean' ? 'seafloor vent' : 'mineral ridge',
        revealed: false,
        mineralsRemaining: randomInteger(random, 2, 5),
      },
      {
        id: 'resource-2',
        kind: 'sample',
        name: biome === 'forest' ? 'biotic specimen' : biome === 'cave' ? 'geode shard' : biome === 'ocean' ? 'deepwater sample' : 'dryland sample',
        revealed: false,
        mineralsRemaining: randomInteger(random, 1, 3),
      },
    ];

    return { seed, biome, resources };
  }

  function createStationSite(seed) {
    const random = createSeededRandom(seed);
    return {
      seed,
      vendors: [
        'hydroponics array',
        'repair dock',
        'auction floor',
      ],
      market: {
        oxygen: randomInteger(random, 1, 3),
        fuel: randomInteger(random, 2, 4),
      },
    };
  }

  function generateGalaxy(count = 7, seed = randomSeed()) {
    const galaxySeed = Number.isFinite(seed) ? Math.floor(seed) >>> 0 : randomSeed();
    const random = createSeededRandom(galaxySeed);
    const prefixes = ['Cinder', 'Iris', 'Hallow', 'Nimble', 'Velvet', 'Blackwater', 'Sunshade', 'Tideglass', 'Ember', 'Lattice', 'Rook', 'Cinder'];
    const types = ['asteroid', 'station', 'planet'];
    const hazards = ['low', 'medium', 'high'];
    const biomes = ['forest', 'cave', 'ocean'];
    const destinations = [];
    const typeOrder = Array.from({ length: count }, (_unused, index) => types[index % types.length]);

    for (let index = typeOrder.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInteger(random, 0, index);
      [typeOrder[index], typeOrder[swapIndex]] = [typeOrder[swapIndex], typeOrder[index]];
    }

    for (let index = 0; index < count; index += 1) {
      const type = typeOrder[index];
      const name = `${prefixes[randomInteger(random, 0, prefixes.length - 1)]} ${index + 1}`;
      const siteSeed = Math.floor(random() * 4294967296) >>> 0;
      const typeBonus = type === 'planet' ? 6 : type === 'station' ? 4 : 2;
      const angle = random() * Math.PI * 2;
      const radius = 15 + index * 10 + randomInteger(random, 0, 8);
      const x = Math.round(radius * Math.cos(angle));
      const y = Math.round(radius * Math.sin(angle));
      const distFromHome = Math.sqrt(x * x + y * y);
      const fuelCost = fuelFromDistance(distFromHome);
      const travelTime = timeFromDistance(distFromHome, typeBonus);
      const biome = type === 'planet' ? biomes[randomInteger(random, 0, biomes.length - 1)] : 'none';
      destinations.push({
        id: `${type}-${index + 1}`,
        type,
        name,
        x,
        y,
        visited: false,
        summary: type === 'asteroid'
          ? 'Dense ore field with drift-salvage and hidden mineral seams.'
          : type === 'station'
            ? 'A crowded trade port in a narrow trade lane.'
            : 'A habitable world with unstable weather and deep biomes.',
        hazard: hazards[randomInteger(random, 0, hazards.length - 1)],
        fuelCost,
        travelTime,
        reward: type === 'asteroid' ? 'ore' : type === 'station' ? 'trade goods' : 'biome samples',
        biome,
        legalStatus: type === 'station' ? 'regulated' : 'open',
        site: type === 'asteroid'
          ? createAsteroidSite(siteSeed)
          : type === 'planet'
            ? createPlanetSite(siteSeed, biome)
            : createStationSite(siteSeed),
      });
    }

    return destinations;
  }

  function createPhase2State(seed = randomSeed()) {
    const galaxySeed = Number.isFinite(seed) ? Math.floor(seed) >>> 0 : randomSeed();
    const destinations = generateGalaxy(7, galaxySeed);
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
        supplies: 0,
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
        galaxySeed,
        destinations,
      },
    };
  }

  function routeFuelCost(state, destination) {
    const engineLevel = Math.max(1, ((state.ship || {}).upgrades || {}).engine || 1);
    const from = getPlayerPosition(state);
    const dx = (destination.x || 0) - from.x;
    const dy = (destination.y || 0) - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const baseFuel = fuelFromDistance(dist);
    return Math.max(1, baseFuel - (engineLevel - 1) * 2);
  }

  function routeTravelTime(state, destination) {
    const from = getPlayerPosition(state);
    const dx = (destination.x || 0) - from.x;
    const dy = (destination.y || 0) - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const typeBonus = destination.type === 'planet' ? 6 : destination.type === 'station' ? 4 : 2;
    return timeFromDistance(dist, typeBonus);
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
    const fuelCost = routeFuelCost(state, destination);
    if ((state.ship || {}).fuel < fuelCost) {
      return { traveling: false, routeId: null, reason: `Not enough fuel for ${destination.name}.` };
    }

    state.ship.fuel = Math.max(0, state.ship.fuel - fuelCost);
    state.phase2 = state.phase2 || {};
    state.phase2.travelling = true;
    state.phase2.routeId = destination.id;
    state.phase2.travelStartedAt = Date.now();
    state.phase2.locationStatus = 'traveling';

    const travelTime = routeTravelTime(state, destination);

    if (typeof setTimeout === 'function') {
      setTimeout(() => {
        resolveTravel(state, destination.id);
        if (typeof onArrival === 'function') onArrival(destination);
      }, travelTime * 1000);
    }

    return { traveling: true, routeId: destination.id, fuelCost, travelTime, ship: state.ship };
  }

  function resolveTravel(state, routeId) {
    const destination = (state.destinations || []).find((item) => item.id === routeId || item.name.toLowerCase() === routeId.toLowerCase());
    if (!destination) return state.phase2;

    state.phase2 = state.phase2 || {};
    state.phase2.travelling = false;
    state.phase2.routeId = null;
    state.phase2.currentDestination = destination;
    state.phase2.locationStatus = 'landed';
    state.phase2.activeZone = destination.type === 'planet' ? destination.biome : 'landing bay';
    destination.visited = true;
    return state.phase2;
  }

  function craftItem(state, recipeId) {
    const recipe = CRAFTING_RECIPES[recipeId];
    if (!recipe) return { success: false, reason: 'Unknown recipe.' };

    const required = recipe.requires || {};
    if ((state.ship || {}).minerals < (required.minerals || 0)) {
      return { success: false, reason: `Not enough minerals to craft ${recipe.name}.` };
    }

    state.ship.minerals -= required.minerals;
    recipe.operate(state.ship);
    return { success: true, ship: state.ship, message: `${recipe.name} assembled on the ship.` };
  }

  function createProgressionState() {
    return {
      routesCompleted: 0,
      tradeRuns: 0,
      explorationRuns: 0,
      reputation: 0,
      tier: 1,
      rank: 'Rookie',
      milestones: [],
    };
  }

  function getProgressionRank(reputation) {
    if (reputation >= 80) return { rank: 'Vanguard', tier: 5 };
    if (reputation >= 50) return { rank: 'Trailblazer', tier: 4 };
    if (reputation >= 30) return { rank: 'Prospector', tier: 3 };
    if (reputation >= 18) return { rank: 'Scout', tier: 2 };
    return { rank: 'Rookie', tier: 1 };
  }

  function awardProgress(state, { destinationType = 'station', source = 'route' } = {}) {
    const progression = state.progression || createProgressionState();
    state.progression = progression;

    const routeValue = destinationType === 'planet' ? 18 : destinationType === 'station' ? 14 : 10;
    const sourceValue = source === 'trade' ? 10 : source === 'explore' ? 8 : 0;
    progression.reputation += routeValue + sourceValue;
    progression.routesCompleted += source === 'route' ? 1 : 0;
    progression.tradeRuns += source === 'trade' ? 1 : 0;
    progression.explorationRuns += source === 'explore' ? 1 : 0;

    const previousTier = progression.tier;
    const nextRank = getProgressionRank(progression.reputation);
    progression.rank = nextRank.rank;
    progression.tier = nextRank.tier;

    if (nextRank.tier > previousTier) {
      state.ship = state.ship || { credits: 0, fuel: 0, upgrades: { engine: 1 } };
      state.ship.upgrades = state.ship.upgrades || {};
      state.ship.upgrades.engine = (state.ship.upgrades.engine || 0) + 1;
      progression.milestones.push(`Frontier rank increased to ${nextRank.rank}.`);
      return {
        success: true,
        rank: nextRank.rank,
        message: `Frontier rank increased to ${nextRank.rank}. Engine tuning improved.`,
      };
    }

    return { success: false, rank: progression.rank, message: `Frontier rank: ${progression.rank}` };
  }

  function normalizeTravelDestination(input) {
    return input.trim().replace(/^to\s+/i, '');
  }

  function discoverNewDestinations(state, count) {
    count = count || 3;
    const dest = state.phase2 && state.phase2.currentDestination;
    const cx = dest ? (dest.x || 0) : 0;
    const cy = dest ? (dest.y || 0) : 0;
    const seed = ((state.phase2 && state.phase2.galaxySeed) || 0) + (state.destinations || []).length * 1000;
    const random = createSeededRandom(seed >>> 0);
    const types = ['asteroid', 'station', 'planet'];
    const biomes = ['forest', 'cave', 'ocean'];
    const prefixes = ['Nova', 'Drift', 'Veil', 'Fracture', 'Deep', 'Outer', 'Rim'];
    const hazards = ['low', 'medium', 'high'];
    const newDests = [];
    for (let i = 0; i < count; i++) {
      const type = types[randomInteger(random, 0, 2)];
      const angle = random() * Math.PI * 2;
      const radius = 20 + randomInteger(random, 0, 30);
      const x = Math.round(cx + radius * Math.cos(angle));
      const y = Math.round(cy + radius * Math.sin(angle));
      const distFromHome = Math.sqrt(x * x + y * y);
      const typeBonus = type === 'planet' ? 6 : type === 'station' ? 4 : 2;
      const fuelCost = fuelFromDistance(distFromHome);
      const travelTime = timeFromDistance(distFromHome, typeBonus);
      const startIndex = (state.destinations || []).length + i;
      const siteSeed = Math.floor(random() * 4294967296) >>> 0;
      const biome = type === 'planet' ? biomes[randomInteger(random, 0, 2)] : 'none';
      newDests.push({
        id: type + '-' + (startIndex + 1),
        type,
        x,
        y,
        visited: false,
        name: prefixes[randomInteger(random, 0, prefixes.length - 1)] + ' ' + (startIndex + 1),
        fuelCost,
        travelTime,
        hazard: hazards[randomInteger(random, 0, 2)],
        reward: type === 'asteroid' ? 'ore' : type === 'station' ? 'trade goods' : 'biome samples',
        biome,
        legalStatus: type === 'station' ? 'regulated' : 'open',
        summary: 'A newly charted location on the frontier.',
        site: type === 'asteroid'
          ? createAsteroidSite(siteSeed)
          : type === 'planet'
            ? createPlanetSite(siteSeed, biome)
            : createStationSite(siteSeed),
      });
    }
    newDests.forEach(function(d) {
      (state.destinations = state.destinations || []).push(d);
      (state.phase2.destinations = state.phase2.destinations || []).push(d);
    });
    return newDests;
  }

  return {
    CRAFTING_RECIPES,
    UPGRADE_DEFINITIONS,
    upgradeShipSystem,
    generateGalaxy,
    createPhase2State,
    startFlight,
    resolveTravel,
    routeFuelCost,
    routeTravelTime,
    getPlayerPosition,
    discoverNewDestinations,
    craftItem,
    fuelCapacity,
    hullCapacity,
    createProgressionState,
    awardProgress,
    normalizeTravelDestination,
  };
});