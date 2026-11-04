const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const game = require('./script.js');
const spaceSystems = require('./space-systems.js');
const gameWorldSource = fs.readFileSync(require.resolve('./game-world.js'), 'utf8');
const spaceSystemsSource = fs.readFileSync(require.resolve('./space-systems.js'), 'utf8');
const phaseOneCommandsSource = fs.readFileSync(require.resolve('./phase1-commands.js'), 'utf8');
const spaceCommandsSource = fs.readFileSync(require.resolve('./space-commands.js'), 'utf8');
const scriptSource = fs.readFileSync(require.resolve('./script.js'), 'utf8');

function createCommandGame() {
  class FakeElement {
    constructor(tagName = 'div') {
      this.tagName = tagName;
      this.children = [];
      this.listeners = {};
      this.style = {};
      this.dataset = {};
      this.classNames = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => this.classNames.add(name)),
        remove: (...names) => names.forEach((name) => this.classNames.delete(name)),
        toggle: (name, force) => {
          const shouldAdd = force === undefined ? !this.classNames.has(name) : force;
          if (shouldAdd) this.classNames.add(name);
          else this.classNames.delete(name);
          return shouldAdd;
        },
      };
    }

    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    setAttribute() {}
    focus() {}
    querySelectorAll() { return []; }
    querySelector() { return null; }
    getContext() {
      return {
        setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {},
        arc() {}, fill() {},
      };
    }
  }

  const ids = [
    'intro-screen', 'game-shell', 'start-game-btn', 'game-output',
    'command-form', 'command-input', 'status-pill', 'map-text',
    'mobile-navigation', 'room-actions', 'phase2-launch-btn', 'map-panel', 'map-svg', 'starfield',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
  const storage = new Map();
  const timers = [];
  const intervals = [];
  const document = {
    body: new FakeElement('body'),
    getElementById: (id) => elements[id] || null,
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
  };
  const window = {
    innerWidth: 1024,
    devicePixelRatio: 1,
    addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  const context = {
    document,
    window,
    performance: { now: () => 0 },
    requestAnimationFrame() {},
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    setInterval: (callback, delay) => { intervals.push({ callback, delay }); return intervals.length; },
  };

  vm.runInNewContext(gameWorldSource, context, { filename: 'game-world.js' });
  vm.runInNewContext(spaceSystemsSource, context, { filename: 'space-systems.js' });
  vm.runInNewContext(phaseOneCommandsSource, context, { filename: 'phase1-commands.js' });
  vm.runInNewContext(spaceCommandsSource, context, { filename: 'space-commands.js' });
  vm.runInNewContext(scriptSource, context, { filename: 'script.js' });
  const form = elements['command-form'];
  const input = elements['command-input'];

  return {
    command(text) {
      input.value = text;
      form.listeners.submit({ preventDefault() {} });
    },
    get state() { return vm.runInNewContext('state', context); },
    get rooms() { return vm.runInNewContext('rooms', context); },
    get output() { return elements['game-output'].children.map((line) => line.textContent).join('\n'); },
    get status() { return elements['status-pill'].textContent; },
    get actionLabels() { return elements['room-actions'].children.map((button) => button.textContent); },
    get phase2LaunchHidden() { return elements['phase2-launch-btn'].hidden; },
    clickPhase2Launch() { elements['phase2-launch-btn'].listeners.click(); },
    clickAction(label) {
      const button = elements['room-actions'].children.find((action) => action.textContent === label);
      assert.ok(button, `expected an action button labeled ${label}`);
      button.listeners.click();
    },
    timers,
    get oxygenIntervalMs() { return intervals[0] && intervals[0].delay; },
    tickOxygen() {
      assert.ok(intervals[0], 'expected an active oxygen recharge interval');
      intervals[0].callback();
    },
    arrive() {
      const timer = timers.shift();
      assert.ok(timer, 'expected a pending travel timer');
      timer.callback();
    },
  };
}

function createPhase2CommandGame() {
  const gameSession = createCommandGame();
  gameSession.state.gameWon = true;
  return gameSession;
}

test('procedural galaxy generation creates routeable destinations', () => {
  const docks = game.generateGalaxy(6, 48271);

  assert.equal(docks.length, 6);
  assert.ok(docks.every((destination) => destination && typeof destination.name === 'string'));
  assert.ok(docks.every((destination) => ['asteroid', 'station', 'planet'].includes(destination.type)));
  assert.ok(docks.every((destination) => destination.travelTime > 0));
  assert.deepEqual(docks, game.generateGalaxy(6, 48271));
  assert.notDeepEqual(docks, game.generateGalaxy(6, 48272));
  assert.ok(docks.filter((destination) => destination.type === 'asteroid').every((destination) => destination.site.locations.length === 3));
});

test('travel destination normalization accepts the documented "to <destination>" form', () => {
  const state = game.createPhase2State();
  const destination = state.destinations[0];

  assert.equal(game.normalizeTravelDestination(` to ${destination.name} `), destination.name);
});

test('crafting consumes resources and upgrades the ship', () => {
  const state = game.createPhase2State();
  state.ship.minerals = 8;
  state.ship.credits = 40;

  const result = game.craftItem(state, 'fuel_cell');
  assert.equal(result.success, true);
  assert.ok(result.ship.fuel >= 90);
  assert.ok(result.ship.modules.includes('fuel_cell'));
  assert.equal(spaceSystems.fuelCapacity(result.ship), 150);
  assert.equal(spaceSystems.hullCapacity(result.ship), 110);
});

test('look, help, inventory, map, examine, movement, and item commands work through the parser', () => {
  const gameSession = createCommandGame();
  const startingOxygen = gameSession.state.oxygenTurns;

  const outputBeforeLook = gameSession.output;
  gameSession.command('look');
  assert.match(gameSession.output.slice(outputBeforeLook.length), /Airlock: The outer airlock/);
  assert.equal(gameSession.state.oxygenTurns, startingOxygen);
  const outputBeforeAlias = gameSession.output;
  gameSession.command('l');
  assert.match(gameSession.output.slice(outputBeforeAlias.length), /Airlock: The outer airlock/);
  const outputBeforeHelp = gameSession.output;
  gameSession.command('help');
  assert.match(gameSession.output.slice(outputBeforeHelp.length), /Commands:/);
  gameSession.command('?');
  assert.match(gameSession.output.slice(outputBeforeHelp.length), /Commands:/);
  gameSession.command('take oxygen key');
  assert.ok(gameSession.state.inventory.includes('oxygen key'));
  assert.equal(gameSession.state.oxygenTurns, startingOxygen - 1);
  gameSession.command('inv');
  assert.match(gameSession.output, /Inventory: oxygen key/);
  gameSession.command('use medkit');
  assert.equal(gameSession.state.oxygenTurns, startingOxygen - 1, 'failed use does not spend oxygen');
  gameSession.command('use oxygen key');
  assert.match(gameSession.output, /unlock the emergency supply locker/);
  gameSession.command('go north');
  assert.equal(gameSession.state.currentRoom, 'dockingBay');
  gameSession.command('w');
  assert.equal(gameSession.state.currentRoom, 'habitatRing');
  gameSession.command('move south');
  assert.equal(gameSession.state.currentRoom, 'crewQuarters');
  gameSession.command('s');
  assert.equal(gameSession.state.currentRoom, 'crewQuarters', 'blocked movement leaves the player in place');
  gameSession.command('x roster');
  gameSession.command('read roster');
  gameSession.command('map');
  gameSession.command('unknown command');
  assert.match(gameSession.output, /Voyage Data:/);
  assert.match(gameSession.output, /You cannot go south/);
  assert.match(gameSession.output, /Unknown command: unknown command/);
});

test('open-ended progression rewards routes without ending the game', () => {
  const gameSession = createPhase2CommandGame();
  const asteroid = gameSession.state.phase2.destinations.find((route) => route.type === 'asteroid');
  const station = gameSession.state.phase2.destinations.find((route) => route.type === 'station');

  assert.equal(gameSession.state.gameOver, false);
  assert.ok(gameSession.state.progression);

  gameSession.command('north');
  gameSession.command('east');
  gameSession.command(`travel to ${asteroid.name}`);
  gameSession.arrive();
  gameSession.command('board');
  gameSession.command(`travel ${station.id}`);
  gameSession.arrive();

  assert.equal(gameSession.state.gameOver, false);
  assert.ok(gameSession.state.progression.routesCompleted >= 2);
  assert.ok(gameSession.state.progression.rank !== 'Rookie');
  assert.ok(gameSession.state.ship.upgrades.engine >= 1);
});

test('ship travel unlocks only after the flux core repairs the ship', () => {
  const gameSession = createCommandGame();
  const destination = gameSession.state.phase2.destinations[0];

  gameSession.command('north');
  gameSession.command('east');
  const fuelBeforeLaunch = gameSession.state.ship.fuel;
  gameSession.command('flight');
  assert.match(gameSession.output, /repair the ship with the flux core before launching into phase 2/i);
  gameSession.command(`travel ${destination.name}`);
  assert.equal(gameSession.state.phase2.travelling, false);
  assert.equal(gameSession.state.ship.fuel, fuelBeforeLaunch);

  gameSession.command('north');
  gameSession.command('take flux core');
  gameSession.command('south');
  gameSession.command('use flux core');
  assert.equal(gameSession.state.gameWon, true);
  gameSession.command('flight');
  assert.match(gameSession.output, new RegExp(destination.name));
  gameSession.command(`travel ${destination.name}`);
  assert.equal(gameSession.state.phase2.travelling, true);
});

test('flight and travel commands list routes, charge fuel, and land by name or id', () => {
  const gameSession = createPhase2CommandGame();
  const destination = gameSession.state.phase2.destinations.find((route) => route.type === 'asteroid');
  const station = gameSession.state.phase2.destinations.find((route) => route.type === 'station');

  gameSession.command('north');
  gameSession.command('east');
  gameSession.command('flight');
  assert.match(gameSession.output, new RegExp(destination.name));
  assert.match(gameSession.output, /Launch a route with: travel to/);

  const startingFuel = gameSession.state.ship.fuel;
  gameSession.command(`travel to ${destination.name}`);
  assert.equal(gameSession.state.phase2.travelling, true);
  assert.equal(gameSession.state.ship.fuel, startingFuel - destination.fuelCost);
  assert.equal(gameSession.timers[0].delay, destination.travelTime * 1000);
  const fuelDuringFlight = gameSession.state.ship.fuel;
  gameSession.command(`travel to ${station.name}`);
  assert.equal(gameSession.state.ship.fuel, fuelDuringFlight, 'a second route cannot launch during transit');
  assert.match(gameSession.output, /already in transit/i);
  gameSession.arrive();
  assert.equal(gameSession.state.phase2.currentDestination.id, destination.id);
  assert.equal(gameSession.state.phase2.currentDestination.type, 'asteroid');
  assert.equal(gameSession.state.phase2.locationStatus, 'landed');
  assert.equal(gameSession.state.phase2.travelling, false);
  assert.match(gameSession.output, new RegExp(`Arrival confirmed: ${destination.name}`));
  assert.ok(gameSession.actionLabels.includes('Board Ship'));

  const landedFuel = gameSession.state.ship.fuel;
  const stationLegFuelCost = spaceSystems.routeFuelCost(gameSession.state, station);
  gameSession.command(`travel ${station.id}`);
  assert.equal(gameSession.state.phase2.travelling, true);
  assert.equal(gameSession.state.ship.fuel, landedFuel - stationLegFuelCost);
  assert.match(gameSession.output, /Auto-boarding ship/);
  gameSession.arrive();
  assert.equal(gameSession.state.phase2.currentDestination.id, station.id);
  assert.equal(gameSession.state.phase2.locationStatus, 'landed');
  gameSession.command('board');
  assert.equal(gameSession.state.phase2.locationStatus, 'orbit');
  assert.equal(gameSession.state.currentRoom, 'commandDeck');
  assert.ok(gameSession.actionLabels.includes('Land at Site'));
  gameSession.command('land');
  assert.equal(gameSession.state.phase2.locationStatus, 'landed');
  assert.ok(gameSession.actionLabels.includes('Board Ship'));
  gameSession.command('return');
  assert.equal(gameSession.state.phase2.locationStatus, 'orbit');
  gameSession.command(`travel ${station.id}`);
  assert.equal(gameSession.state.phase2.travelling, true);
  gameSession.arrive();
  assert.equal(gameSession.state.phase2.currentDestination.id, station.id);

  const fuelAfterArrival = gameSession.state.ship.fuel;
  gameSession.command('travel to nowhere');
  assert.equal(gameSession.state.ship.fuel, fuelAfterArrival);
  assert.match(gameSession.output, /No route matches nowhere/);
});

test('mining, exploration, trading, and crafting update resources and report failures', () => {
  const gameSession = createPhase2CommandGame();
  const asteroid = gameSession.state.phase2.destinations.find((route) => route.type === 'asteroid');
  const station = gameSession.state.phase2.destinations.find((route) => route.type === 'station');

  gameSession.command('north');
  gameSession.command('east');
  gameSession.command(`travel to ${asteroid.name}`);
  gameSession.arrive();
  assert.equal(gameSession.state.phase2.currentDestination.type, 'asteroid');
  const totalOre = asteroid.site.locations
    .filter((location) => location.kind === 'ore')
    .reduce((total, location) => total + location.mineralsRemaining, 0);
  const salvageCredits = asteroid.site.locations.find((location) => location.kind === 'salvage').credits;
  for (const location of asteroid.site.locations) {
    gameSession.command('explore');
    if (location.kind === 'ore') {
      assert.match(gameSession.output, new RegExp(location.name));
      while (location.mineralsRemaining > 0) gameSession.command('mine');
    }
  }
  assert.equal(gameSession.state.ship.minerals, 6 + totalOre);
  assert.equal(gameSession.state.ship.credits, 45 + salvageCredits);
  gameSession.command('explore');
  gameSession.command('mine');
  assert.equal(gameSession.state.ship.minerals, 6 + totalOre, 'exhausted sites cannot produce more ore');
  assert.match(gameSession.output, /covered every point of interest/);
  gameSession.command('trade list');
  assert.match(gameSession.output, /need to arrive at a station or planet/);
  gameSession.command('board');
  gameSession.command('mine');
  assert.equal(gameSession.state.ship.minerals, 6 + totalOre, 'mining is unavailable while aboard the ship');
  gameSession.command('land');
  gameSession.command('trade list');
  assert.match(gameSession.output, /need to arrive at a station or planet/);

  gameSession.command('board');
  gameSession.command(`travel ${station.name}`);
  assert.equal(gameSession.state.phase2.travelling, true);
  assert.equal(gameSession.state.phase2.routeId, station.id);
  gameSession.arrive();
  assert.equal(gameSession.state.phase2.currentDestination.type, 'station');
  gameSession.command('trade list');
  assert.match(gameSession.output, /Trade menu:/);

  gameSession.command('trade sell minerals');
  assert.equal(gameSession.state.ship.minerals, 0);
  assert.equal(gameSession.state.ship.credits, 45 + salvageCredits + (6 + totalOre) * 4);
  gameSession.command('craft fuel_cell');
  assert.match(gameSession.output, /Not enough minerals/);

  gameSession.state.ship.minerals = 7;
  gameSession.state.ship.hull = 90;
  const fuelBeforeCraft = gameSession.state.ship.fuel;
  gameSession.command('craft fuel_cell');
  assert.equal(gameSession.state.ship.minerals, 3);
  assert.equal(gameSession.state.ship.fuel, Math.min(spaceSystems.fuelCapacity(gameSession.state.ship), fuelBeforeCraft + 24));
  gameSession.command('craft alloy_patch');
  assert.equal(gameSession.state.ship.minerals, 0);
  assert.equal(gameSession.state.ship.hull, 102);
  assert.ok(gameSession.state.ship.modules.includes('fuel_cell'));
  assert.ok(gameSession.state.ship.modules.includes('alloy_patch'));
  gameSession.command('craft unknown');
  assert.match(gameSession.output, /Unknown recipe/);
});

test('seeded asteroid progress survives save/load and reset starts a new galaxy', () => {
  const gameSession = createPhase2CommandGame();
  const asteroid = gameSession.state.destinations.find((route) => route.type === 'asteroid');

  gameSession.command('north');
  gameSession.command('east');
  gameSession.command(`travel ${asteroid.name}`);
  gameSession.arrive();
  while (!asteroid.site.locations.some((location) => location.kind === 'ore' && location.revealed)) {
    gameSession.command('explore');
  }
  gameSession.command('mine');
  const savedSite = JSON.stringify(asteroid.site);
  const originalSeed = gameSession.state.phase2.galaxySeed;
  gameSession.command('save');
  gameSession.command('reset');

  assert.notEqual(gameSession.state.phase2.galaxySeed, originalSeed);
  assert.equal(gameSession.state.destinations, gameSession.state.phase2.destinations);
  gameSession.command('load');

  const loadedAsteroid = gameSession.state.destinations.find((route) => route.id === asteroid.id);
  assert.equal(gameSession.state.phase2.galaxySeed, originalSeed);
  assert.equal(JSON.stringify(loadedAsteroid.site), savedSite);
  assert.equal(gameSession.state.phase2.currentDestination, loadedAsteroid);
  const remainingOre = loadedAsteroid.site.locations.find((location) => location.kind === 'ore' && location.revealed).mineralsRemaining;
  gameSession.command('mine');
  assert.equal(loadedAsteroid.site.locations.find((location) => location.kind === 'ore' && location.revealed).mineralsRemaining, Math.max(0, remainingOre - 2));
});

test('planet destinations support a local resource loop and cargo visibility', () => {
  const gameSession = createPhase2CommandGame();
  const planet = gameSession.state.phase2.destinations.find((route) => route.type === 'planet');

  gameSession.command('north');
  gameSession.command('east');
  gameSession.command(`travel to ${planet.name}`);
  gameSession.arrive();

  assert.equal(gameSession.state.phase2.currentDestination.type, 'planet');
  assert.ok(planet.site && Array.isArray(planet.site.resources) && planet.site.resources.length > 0);

  const firstResource = planet.site.resources.find((resource) => !resource.revealed);
  const oxygenBeforeFullCargoSurvey = gameSession.state.oxygenTurns;
  gameSession.state.ship.cargo = Array(gameSession.state.ship.cargoLimit).fill('occupied');
  gameSession.command('explore');
  assert.equal(firstResource.revealed, false, 'a full cargo bay must not consume an undiscovered sample');
  assert.equal(gameSession.state.oxygenTurns, oxygenBeforeFullCargoSurvey);
  gameSession.state.ship.cargo = [];

  const beforeMine = gameSession.state.ship.minerals;
  gameSession.command('explore');
  assert.ok(gameSession.state.ship.cargo.length > 0 || gameSession.state.ship.minerals > beforeMine, 'planet exploration should generate a resource or cargo reward');
  gameSession.command('mine');
  assert.ok(gameSession.state.ship.minerals >= beforeMine, 'planet mining should advance the resource loop');

  gameSession.command('ship');
  assert.match(gameSession.output, /Cargo:/);
});

test('phase one supplies and planet cargo have playable payoff in phase two', () => {
  const gameSession = createPhase2CommandGame();
  const planet = gameSession.state.phase2.destinations.find((route) => route.type === 'planet');

  gameSession.command('take oxygen key');
  gameSession.command('use oxygen key');
  assert.ok(gameSession.state.ship.modules.includes('emergency_supply_cache'));
  assert.ok(gameSession.state.ship.fuel >= 90 || gameSession.state.ship.credits > 45);

  gameSession.command('north');
  gameSession.command('east');
  gameSession.command(`travel to ${planet.name}`);
  gameSession.arrive();
  gameSession.command('explore');
  assert.ok(gameSession.state.ship.cargo.length > 0);
  gameSession.command('board');
  gameSession.command('land');
  gameSession.command('trade list');
  assert.match(gameSession.output, /sell cargo/i);
  gameSession.command('trade sell cargo');
  assert.equal(gameSession.state.ship.cargo.length, 0);
  assert.ok(gameSession.state.ship.credits > 45);

  const station = gameSession.state.phase2.destinations.find((route) => route.type === 'station');
  gameSession.command('board');
  gameSession.command(`travel ${station.id}`);
  gameSession.arrive();
  gameSession.command('trade buy supplies');
  assert.equal(gameSession.state.ship.supplies, 1);
  const oxygenBeforeUse = gameSession.state.oxygenTurns;
  gameSession.command('use survival pack');
  assert.equal(gameSession.state.ship.supplies, 0);
  assert.ok(gameSession.state.oxygenTurns > oxygenBeforeUse);
});

test('collected items and installed modules have real, inspectable effects', () => {
  const gameSession = createCommandGame();

  gameSession.command('take nav console');
  assert.ok(!gameSession.state.inventory.includes('nav console'));
  assert.match(gameSession.output, /do not see a nav console/i);

  gameSession.command('north');
  gameSession.command('take fuel cell');
  const fuelBeforeUse = gameSession.state.ship.fuel;
  gameSession.command('use fuel cell');
  assert.ok(gameSession.state.ship.modules.includes('fuel_cell'));
  assert.ok(gameSession.state.ship.fuel > fuelBeforeUse);
  assert.ok(!gameSession.state.inventory.includes('fuel cell'));

  gameSession.command('inspect modules');
  assert.match(gameSession.output, /fuel cell.*fuel capacity/i);
  assert.match(gameSession.output, /basic scanner.*survey/i);
  assert.equal(spaceSystems.fuelCapacity(gameSession.state.ship), 150);

  gameSession.state.ship.supplies = 1;
  gameSession.state.oxygenTurns = 0;
  gameSession.state.gameOver = true;
  gameSession.command('use survival pack');
  assert.equal(gameSession.state.oxygenTurns, 4);
  assert.equal(gameSession.state.gameOver, false);
  assert.equal(gameSession.state.ship.supplies, 0);

  gameSession.command('take oxygen key');
  gameSession.command('use oxygen key');
  const creditsAfterUnlock = gameSession.state.ship.credits;
  const fuelAfterUnlock = gameSession.state.ship.fuel;
  gameSession.command('use oxygen key');
  assert.equal(gameSession.state.ship.credits, creditsAfterUnlock);
  assert.equal(gameSession.state.ship.fuel, fuelAfterUnlock);
});

test('navigation, scanner, and engine upgrades affect route and survey actions', () => {
  const gameSession = createPhase2CommandGame();
  const planet = gameSession.state.phase2.destinations.find((route) => route.type === 'planet');

  gameSession.command('north');
  gameSession.command('east');
  gameSession.state.ship.modules = gameSession.state.ship.modules.filter((module) => module !== 'nav_console');
  gameSession.command('flight');
  assert.match(gameSession.output, /navigation console module is required/i);
  gameSession.command(`travel ${planet.name}`);
  assert.equal(gameSession.state.phase2.travelling, false);

  gameSession.state.ship.modules.push('nav_console');
  gameSession.state.ship.upgrades.engine = 3;
  const fuelBeforeTravel = gameSession.state.ship.fuel;
  const discountedCost = Math.max(1, planet.fuelCost - 4);
  gameSession.command(`travel ${planet.name}`);
  assert.equal(gameSession.state.ship.fuel, fuelBeforeTravel - discountedCost);
  assert.match(gameSession.output, new RegExp(`Fuel burn: ${discountedCost}`));
  gameSession.arrive();
  gameSession.state.ship.modules = gameSession.state.ship.modules.filter((module) => module !== 'basic_scanner');
  gameSession.command('explore');
  assert.match(gameSession.output, /basic scanner module is required/i);
  assert.equal(planet.site.resources.some((resource) => resource.revealed), false);
});

test('station trade actions enforce credits and update ship supplies', () => {
  const gameSession = createPhase2CommandGame();
  const station = gameSession.state.phase2.destinations.find((route) => route.type === 'station');

  gameSession.command('north');
  gameSession.command('east');
  gameSession.command(`travel ${station.name}`);
  gameSession.arrive();
  const creditsBeforeExplore = gameSession.state.ship.credits;
  gameSession.command('explore');
  assert.equal(gameSession.state.ship.credits, creditsBeforeExplore + 8);
  gameSession.command('explore');
  assert.equal(gameSession.state.ship.credits, creditsBeforeExplore + 8, 'station surveys pay only once');
  const creditsBeforeFuel = gameSession.state.ship.credits;
  gameSession.command('trade buy fuel');
  assert.equal(gameSession.state.ship.credits, creditsBeforeFuel - 12);
  assert.equal(gameSession.state.ship.fuel, 90 - station.fuelCost + 18);
  gameSession.command('trade buy supplies');
  assert.equal(gameSession.state.ship.credits, creditsBeforeFuel - 22);
  assert.equal(gameSession.state.ship.supplies, 1);
  gameSession.state.ship.credits = 0;
  gameSession.command('trade buy fuel');
  assert.match(gameSession.output, /not have enough credits/);
  assert.equal(gameSession.state.ship.fuel, 90 - station.fuelCost + 18);
  gameSession.state.ship.fuel = spaceSystems.fuelCapacity(gameSession.state.ship);
  gameSession.state.ship.credits = 20;
  gameSession.command('trade buy fuel');
  assert.match(gameSession.output, /fuel tanks are already full/);
  assert.equal(gameSession.state.ship.credits, 20);
});

test('oxygen can be recharged at trade destinations without consuming the reserve', () => {
  const gameSession = createPhase2CommandGame();
  const station = gameSession.state.destinations.find((route) => route.type === 'station');

  gameSession.command('north');
  gameSession.command('east');
  gameSession.command(`travel ${station.name}`);
  gameSession.arrive();
  const oxygenBeforeTradeMenu = gameSession.state.oxygenTurns;
  gameSession.command('trade list');
  assert.equal(gameSession.state.oxygenTurns, oxygenBeforeTradeMenu);
  assert.match(gameSession.output, /buy oxygen \(8 credits for up to 6 actions\)/);

  gameSession.state.oxygenTurns = 2;
  gameSession.command('trade buy oxygen');
  assert.equal(gameSession.state.oxygenTurns, 8);
  assert.equal(gameSession.state.ship.credits, 37);
  assert.equal(gameSession.state.gameOver, false);

  gameSession.state.oxygenTurns = 0;
  gameSession.state.gameOver = true;
  gameSession.command('status');
  assert.ok(gameSession.actionLabels.includes('Buy Oxygen'));
  gameSession.clickAction('Buy Oxygen');
  assert.equal(gameSession.state.oxygenTurns, 6);
  assert.equal(gameSession.state.ship.credits, 29);
  assert.equal(gameSession.state.gameOver, false);

  gameSession.state.oxygenTurns = 17;
  gameSession.command('trade buy oxygen');
  assert.equal(gameSession.state.oxygenTurns, 18, 'refills stop at the current oxygen capacity');
  assert.equal(gameSession.state.ship.credits, 21);
  gameSession.command('trade buy oxygen');
  assert.equal(gameSession.state.ship.credits, 21, 'a full reserve cannot be purchased again');

  gameSession.state.oxygenTurns = 1;
  gameSession.state.ship.credits = 0;
  gameSession.command('trade buy oxygen');
  assert.equal(gameSession.state.oxygenTurns, 1);
  assert.match(gameSession.output, /need 8 credits/);
});

test('oxygen automatically restores one action every twenty seconds, including from zero', () => {
  const gameSession = createCommandGame();
  assert.equal(gameSession.oxygenIntervalMs, 20000);

  gameSession.state.oxygenTurns = 16;
  gameSession.tickOxygen();
  assert.equal(gameSession.state.oxygenTurns, 17);
  gameSession.tickOxygen();
  assert.equal(gameSession.state.oxygenTurns, 18);
  gameSession.tickOxygen();
  assert.equal(gameSession.state.oxygenTurns, 18, 'automatic recovery stops at capacity');

  gameSession.state.systemsRepaired = true;
  gameSession.state.oxygenTurns = 22;
  gameSession.tickOxygen();
  assert.equal(gameSession.state.oxygenTurns, 22, 'repair bonus increases the recharge cap');

  gameSession.state.oxygenTurns = 0;
  gameSession.state.gameOver = true;
  gameSession.tickOxygen();
  assert.equal(gameSession.state.oxygenTurns, 1);
  assert.equal(gameSession.state.gameOver, false);
  assert.equal(gameSession.status, 'O2 1/22 | Rookie');
  assert.match(gameSession.output, /Emergency oxygen restored/);
});

test('flight console access, destination alias, and insufficient fuel are handled', () => {
  const gameSession = createPhase2CommandGame();
  const destination = gameSession.state.phase2.destinations[0];

  gameSession.command('flight');
  assert.match(gameSession.output, /need to be on the command deck/);
  gameSession.command('north');
  gameSession.command('east');
  gameSession.command('destinations');
  assert.match(gameSession.output, new RegExp(destination.name));

  gameSession.state.ship.fuel = destination.fuelCost - 1;
  gameSession.command(`travel to ${destination.name}`);
  assert.equal(gameSession.state.phase2.travelling, false);
  assert.equal(gameSession.timers.length, 0);
  assert.match(gameSession.output, /Not enough fuel/);
});

test('hazard rooms charge extra oxygen and zero-oxygen saves remain terminal', () => {
  const gameSession = createCommandGame();

  gameSession.command('east');
  assert.equal(gameSession.state.oxygenTurns, 17, 'entering maintenance costs the normal movement amount');
  gameSession.command('take repair patch');
  assert.equal(gameSession.state.oxygenTurns, 15, 'maintenance actions include a leak surcharge');
  gameSession.command('west');
  gameSession.command('north');
  gameSession.command('west');
  gameSession.command('north');
  assert.equal(gameSession.state.currentRoom, 'observationDeck');
  assert.equal(gameSession.state.oxygenTurns, 10, 'entering the observation deck costs the normal movement amount');

  gameSession.state.oxygenTurns = 1;
  gameSession.command('read beacon');
  assert.equal(gameSession.state.gameOver, true, 'examining the beacon costs two oxygen in the debris field');
  assert.equal(gameSession.state.oxygenTurns, 0);
  assert.match(gameSession.output, /Dr\. Chen, medical officer/);
  assert.equal(gameSession.state.gameOver, true);
  assert.equal(gameSession.state.oxygenTurns, 0);
  gameSession.command('save');
  gameSession.command('reset');
  gameSession.command('load');
  assert.equal(gameSession.state.gameOver, true);
  assert.equal(gameSession.state.oxygenTurns, 0);
  assert.equal(gameSession.status, 'No Oxygen');
});

test('medkit rescue clears the debris hazard and rewards emergency oxygen', () => {
  const gameSession = createCommandGame();

  gameSession.command('north');
  gameSession.command('west');
  gameSession.command('take medkit');
  gameSession.command('north');
  assert.match(gameSession.output, /Actions here cost 2 oxygen/);
  assert.ok(gameSession.actionLabels.includes('Use medkit'));
  gameSession.command('examine beacon');
  assert.match(gameSession.output, /Dr\. Chen, medical officer/);

  const oxygenBeforeRescue = gameSession.state.oxygenTurns;
  gameSession.command('use medkit');
  assert.equal(gameSession.state.crewSaved, true);
  assert.equal(gameSession.state.oxygenTurns, oxygenBeforeRescue + 2);
  assert.match(gameSession.output, /Dr\. Chen shares emergency oxygen: \+4 actions/);
  assert.ok(!gameSession.actionLabels.includes('Use medkit'));
  const oxygenBeforeSafeMove = gameSession.state.oxygenTurns;
  gameSession.command('look');
  gameSession.command('south');
  assert.equal(gameSession.state.oxygenTurns, oxygenBeforeSafeMove - 1);
});

test('phase one item use and room examinations reveal the mission clues', () => {
  const gameSession = createCommandGame();

  gameSession.command('examine star map');
  assert.match(gameSession.output, /route grid is available from the command deck/);
  gameSession.command('north');
  gameSession.command('examine crates');
  assert.match(gameSession.output, /only recoverable equipment/);
  gameSession.command('examine shuttle');
  assert.match(gameSession.output, /need a fuel cell to power it up/);
  gameSession.command('take fuel cell');
  assert.ok(gameSession.actionLabels.includes('Use fuel cell'));
  gameSession.command('use fuel cell');
  assert.match(gameSession.output, /access the flight logs/);
  gameSession.command('east');
  gameSession.command('examine console');
  assert.match(gameSession.output, /REACTOR OFFLINE - CRITICAL ERROR/);
  gameSession.command('north');
  gameSession.command('examine core');
  assert.match(gameSession.output, /crystalline flux core/);
  gameSession.command('south');
  gameSession.command('west');
  gameSession.command('west');
  gameSession.command('south');
  gameSession.command('examine roster');
  assert.match(gameSession.output, /Dr\. Sarah Chen - Medical Officer/);
});

test('emergency rations found in crew quarters can be used', () => {
  const gameSession = createCommandGame();

  gameSession.command('north');
  gameSession.command('west');
  gameSession.command('south');
  gameSession.command('take emergency rations');
  assert.ok(gameSession.state.inventory.includes('emergency rations'));
  gameSession.state.oxygenTurns = 0;
  gameSession.state.gameOver = true;
  gameSession.command('status');
  assert.ok(gameSession.actionLabels.includes('Use Emergency Rations'));
  gameSession.clickAction('Use Emergency Rations');
  assert.ok(!gameSession.state.inventory.includes('emergency rations'));
  assert.equal(gameSession.state.oxygenTurns, 4);
  assert.equal(gameSession.state.gameOver, false);
});

test('repair patch restores life support, clears the leak, and rewards oxygen', () => {
  const gameSession = createCommandGame();

  gameSession.command('east');
  assert.match(gameSession.output, /pressure leak is draining oxygen/);
  gameSession.command('take repair patch');
  assert.ok(gameSession.actionLabels.includes('Use repair patch'));
  const oxygenBeforeRepair = gameSession.state.oxygenTurns;
  gameSession.command('use repair patch');
  assert.equal(gameSession.state.systemsRepaired, true);
  assert.equal(gameSession.state.oxygenTurns, oxygenBeforeRepair + 2);
  assert.match(gameSession.output, /Restored life support expands your oxygen reserve: \+4 actions/);
  assert.ok(!gameSession.actionLabels.includes('Use repair patch'));
  const oxygenBeforeSafeMove = gameSession.state.oxygenTurns;
  gameSession.command('west');
  gameSession.command('east');
  assert.equal(gameSession.state.oxygenTurns, oxygenBeforeSafeMove - 2);
});

test('phase one mission ending reflects both optional rescue and repair objectives', () => {
  const endings = [
    { crewSaved: false, systemsRepaired: false, title: 'Fragile Return' },
    { crewSaved: true, systemsRepaired: false, title: 'Last-Minute Evacuation' },
    { crewSaved: false, systemsRepaired: true, title: 'Silent Homecoming' },
    { crewSaved: true, systemsRepaired: true, title: 'Rescue Beacon' },
  ];

  endings.forEach(({ crewSaved, systemsRepaired, title }) => {
    const gameSession = createCommandGame();
    gameSession.state.crewSaved = crewSaved;
    gameSession.state.systemsRepaired = systemsRepaired;
    gameSession.command('north');
    gameSession.command('east');
    gameSession.command('north');
    gameSession.command('take flux core');
    gameSession.command('south');
    gameSession.command('use flux core');

    assert.match(gameSession.output, new RegExp(`${title}:`));
    assert.ok(gameSession.actionLabels.includes('Launch Phase 2'));
    assert.equal(gameSession.phase2LaunchHidden, false);
    gameSession.clickPhase2Launch();
    assert.match(gameSession.output, /Flight Console — route table/);
  });
});

test('ship status, save, load, and reset preserve or restore expected state', () => {
  const gameSession = createCommandGame();

  gameSession.command('save');
  gameSession.command('take oxygen key');
  gameSession.command('north');
  gameSession.command('ship');
  assert.match(gameSession.output, /Hull: 100\/110 \| Shields: 40/);
  gameSession.command('status');
  assert.equal(gameSession.state.currentRoom, 'dockingBay');
  gameSession.command('load');
  assert.equal(gameSession.state.currentRoom, 'airlock');
  assert.deepEqual(Array.from(gameSession.state.inventory), []);
  assert.equal(gameSession.state.oxygenTurns, 18);
  assert.ok(Array.from(gameSession.rooms.airlock.items).includes('oxygen key'));
  assert.match(gameSession.output, /Saved progress restored/);

  gameSession.command('take oxygen key');
  gameSession.command('save');
  gameSession.command('north');
  gameSession.command('load');
  assert.deepEqual(Array.from(gameSession.state.inventory), ['oxygen key']);
  assert.equal(gameSession.state.oxygenTurns, 17);

  gameSession.command('reset');
  assert.equal(gameSession.state.currentRoom, 'airlock');
  assert.equal(gameSession.state.oxygenTurns, 18);
  assert.equal(gameSession.state.inventory.length, 0);
  assert.ok(Array.from(gameSession.rooms.airlock.items).includes('oxygen key'));
});

test('oxygen depletion blocks further actions until reset', () => {
  const gameSession = createCommandGame();
  gameSession.state.oxygenTurns = 1;

  gameSession.command('take oxygen key');
  assert.equal(gameSession.state.gameOver, true);
  assert.equal(gameSession.status, 'No Oxygen');
  gameSession.command('north');
  assert.equal(gameSession.state.currentRoom, 'airlock');
  assert.match(gameSession.output, /Oxygen is depleted/);

  gameSession.command('reset');
  assert.equal(gameSession.state.gameOver, false);
  assert.equal(gameSession.state.oxygenTurns, 18);
  assert.ok(Array.from(gameSession.rooms.airlock.items).includes('oxygen key'));
});

test('player can retrieve the flux core and complete the original mission', () => {
  const gameSession = createCommandGame();

  gameSession.command('take oxygen key');
  gameSession.command('north');
  gameSession.command('east');
  gameSession.command('north');
  gameSession.command('take flux core');
  gameSession.command('south');
  gameSession.command('use flux core');

  assert.equal(gameSession.state.gameWon, true);
  assert.match(gameSession.output, /ship comes back online/);
  assert.match(gameSession.status, /Mission Complete/);
});

test('scenery descriptions and inventory items have descriptive examinations with state changes', () => {
  const gameSession = createCommandGame();
  gameSession.state.oxygenTurns = 40;

  // Airlock scenery & item examination
  gameSession.command('examine hatch');
  assert.match(gameSession.output, /heavy pressure hatch/i);
  gameSession.command('examine wall');
  assert.match(gameSession.output, /titanium-alloy bulkhead/i);
  gameSession.command('examine oxygen');
  assert.match(gameSession.output, /metallic, kept breathable/i);
  gameSession.command('examine locker');
  assert.match(gameSession.output, /requires an oxygen key/i);
  gameSession.command('examine oxygen key');
  assert.match(gameSession.output, /stamped steel bypass key/i);

  // Take and examine in inventory
  gameSession.command('take oxygen key');
  gameSession.command('examine oxygen key');
  assert.match(gameSession.output, /stamped steel bypass key/i);

  // Habitat ring scenery & items
  gameSession.command('north');
  gameSession.command('west');
  gameSession.command('examine domes');
  assert.match(gameSession.output, /armaglass domes/i);
  gameSession.command('examine pods');
  assert.match(gameSession.output, /cryo-stasis sleep pods/i);
  gameSession.command('examine light');
  assert.match(gameSession.output, /emerald hue/i);
  gameSession.command('examine medkit');
  assert.match(gameSession.output, /compact trauma kit/i);

  // Observation deck dynamic state check
  gameSession.command('take medkit');
  gameSession.command('north');
  gameSession.command('examine windows');
  assert.match(gameSession.output, /panoramic view/i);
  gameSession.command('examine debris');
  assert.match(gameSession.output, /micrometeorites/i);
  gameSession.command('examine beacon');
  assert.match(gameSession.output, /Dr\. Chen, medical officer/i);
  gameSession.command('use medkit');
  assert.equal(gameSession.state.crewSaved, true);
  gameSession.command('examine beacon');
  assert.match(gameSession.output, /Dr\. Chen's vitals are green/i);

  // Reactor core dynamic state check
  gameSession.command('south');
  gameSession.command('east');
  gameSession.command('east');
  gameSession.command('north');
  gameSession.command('examine harness');
  assert.match(gameSession.output, /magnetic locking harness/i);
  gameSession.command('examine core');
  assert.match(gameSession.output, /crystalline flux core/i);
  gameSession.command('take flux core');
  gameSession.command('examine core');
  assert.match(gameSession.output, /harness stands empty/i);
  gameSession.command('examine flux core');
  assert.match(gameSession.output, /quantum power cell/i);

  // Command deck dynamic state check
  gameSession.command('south');
  gameSession.command('examine panels');
  assert.match(gameSession.output, /backlit switches/i);
  gameSession.command('examine comms');
  assert.match(gameSession.output, /subspace transceiver/i);
  gameSession.command('examine grid');
  assert.match(gameSession.output, /3D astrogation grid/i);
  gameSession.command('examine console');
  assert.match(gameSession.output, /REACTOR OFFLINE/i);
  gameSession.command('use flux core');
  assert.equal(gameSession.state.gameWon, true);
  gameSession.command('examine console');
  assert.match(gameSession.output, /Sublight drives and hyper-jump routes are online/i);
});

test('spare parts in maintenance corridor can be salvaged or taken for raw minerals', () => {
  const gameSession = createCommandGame();
  const initialMinerals = gameSession.state.ship.minerals || 0;

  gameSession.command('east');
  assert.equal(gameSession.state.currentRoom, 'maintenanceCorridor');
  gameSession.command('examine spare parts');
  assert.match(gameSession.output, /salvage them for raw minerals/i);
  gameSession.command('examine cabinets');
  assert.match(gameSession.output, /service lockers/i);
  gameSession.command('examine pipes');
  assert.match(gameSession.output, /coolant and atmosphere conduits/i);

  gameSession.command('take spare parts');
  assert.equal(gameSession.state.sparePartsSalvaged, true);
  assert.equal(gameSession.state.ship.minerals, initialMinerals + 3);
  assert.match(gameSession.output, /adding 3 minerals to your ship stores/i);

  // Cannot salvage twice
  gameSession.command('take spare parts');
  assert.match(gameSession.output, /already salvaged/i);
  assert.equal(gameSession.state.ship.minerals, initialMinerals + 3);
});

test('player can drop items and examine modules individually', () => {
  const gameSession = createCommandGame();

  gameSession.command('take oxygen key');
  assert.ok(gameSession.state.inventory.includes('oxygen key'));
  gameSession.command('drop oxygen key');
  assert.ok(!gameSession.state.inventory.includes('oxygen key'));
  assert.ok(gameSession.rooms.airlock.items.includes('oxygen key'));
  assert.match(gameSession.output, /You drop the oxygen key/i);

  // Inspect individual module
  gameSession.command('inspect basic scanner');
  assert.match(gameSession.output, /surveys asteroid fields/i);
  gameSession.command('examine nav console');
  assert.match(gameSession.output, /plots interplanetary travel routes/i);
});

test('scan, cargo, minerals, and lab sample analysis provide interactive utility', () => {
  const gameSession = createPhase2CommandGame();

  // Test scan from orbit/holding
  gameSession.command('scan');
  assert.match(gameSession.output, /Sensor Suite — Orbital Sweep/i);

  // Test cargo and minerals commands
  gameSession.command('cargo');
  assert.match(gameSession.output, /Ship Cargo Hold/i);
  gameSession.command('minerals');
  assert.match(gameSession.output, /Ship Mineral Stores/i);

  // Add sample to cargo and test analysis
  gameSession.state.ship.cargo = ['biotic specimen'];
  gameSession.command('cargo');
  assert.match(gameSession.output, /biotic specimen/i);
  gameSession.command('examine biotic specimen');
  assert.match(gameSession.output, /preserved biological sample/i);

  const creditsBefore = gameSession.state.ship.credits;
  gameSession.command('use biotic specimen');
  assert.match(gameSession.output, /analyze the biotic specimen/i);
  assert.equal(gameSession.state.ship.credits, creditsBefore + 6);
  assert.equal(gameSession.state.ship.cargo.length, 0);
});

test('ship upgrades and expanded crafting recipes improve player capabilities and stats', () => {
  const gameSession = createPhase2CommandGame();

  // Test upgrade listing
  gameSession.command('upgrade');
  assert.match(gameSession.output, /Ship Upgrades & Engineering/i);
  assert.match(gameSession.output, /Hyper-Engine Tuning/i);

  // Give resources and perform upgrades
  gameSession.state.ship.minerals = 20;
  gameSession.state.ship.credits = 100;
  const initialMining = gameSession.state.ship.upgrades.mining || 1;
  gameSession.command('upgrade mining');
  assert.equal(gameSession.state.ship.upgrades.mining, initialMining + 1);
  assert.match(gameSession.output, /Extraction Beam Calibrator upgraded to level 2/i);

  const initialEngine = gameSession.state.ship.upgrades.engine || 1;
  gameSession.command('upgrade engine');
  assert.equal(gameSession.state.ship.upgrades.engine, initialEngine + 1);

  // Test new crafting recipes
  gameSession.state.ship.minerals = 15;
  gameSession.command('craft shield_capacitor');
  assert.ok(gameSession.state.ship.modules.includes('shield_capacitor'));
  assert.ok(gameSession.state.ship.shields > 40);

  gameSession.command('craft deep_scanner');
  assert.ok(gameSession.state.ship.modules.includes('deep_scanner'));

  gameSession.command('craft mining_laser');
  assert.ok(gameSession.state.ship.modules.includes('mining_laser'));
  assert.equal(gameSession.state.ship.upgrades.mining, initialMining + 2);
});
