(function (root, factory) {
  const spaceCommands = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = spaceCommands;
  } else {
    root.DeepDriftSpaceCommands = spaceCommands;
  }
})(globalThis, function () {
  function createSpaceCommands({
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
    upgradeShipSystem,
    UPGRADE_DEFINITIONS,
    awardProgress,
    discoverNewDestinations,
  }) {
    const getAwardProgress = typeof awardProgress === 'function'
      ? awardProgress
      : (typeof globalThis.DeepDriftSpace !== 'undefined' && typeof globalThis.DeepDriftSpace.awardProgress === 'function')
        ? globalThis.DeepDriftSpace.awardProgress
        : (typeof require !== 'undefined')
          ? require('./space-systems.js').awardProgress
          : () => ({ success: false });

    const getUpgradeShipSystem = typeof upgradeShipSystem === 'function'
      ? upgradeShipSystem
      : (typeof globalThis.DeepDriftSpace !== 'undefined' && typeof globalThis.DeepDriftSpace.upgradeShipSystem === 'function')
        ? globalThis.DeepDriftSpace.upgradeShipSystem
        : (typeof require !== 'undefined')
          ? require('./space-systems.js').upgradeShipSystem
          : null;

    const upgradeDefs = (typeof UPGRADE_DEFINITIONS === 'object' && UPGRADE_DEFINITIONS)
      ? UPGRADE_DEFINITIONS
      : (typeof globalThis.DeepDriftSpace !== 'undefined' && globalThis.DeepDriftSpace.UPGRADE_DEFINITIONS)
        ? globalThis.DeepDriftSpace.UPGRADE_DEFINITIONS
        : (typeof require !== 'undefined' && require('./space-systems.js').UPGRADE_DEFINITIONS)
          ? require('./space-systems.js').UPGRADE_DEFINITIONS
          : {};

    const OXYGEN_RECHARGE_COST = 8;
    const OXYGEN_RECHARGE_AMOUNT = 6;

    function handleFlight() {
      if (state.currentRoom !== 'commandDeck') {
        appendLine('You need to be on the command deck to access the flight console.', 'warning');
        return false;
      }
      if (!state.gameWon) {
        appendLine('Repair the ship with the flux core before launching into Phase 2.', 'warning');
        return false;
      }
      if (!(state.ship.modules || []).includes('nav_console')) {
        appendLine('The navigation console module is required to plot routes.', 'warning');
        return false;
      }
      appendLine('Flight Console — route table', 'system');
      appendLine('Plot a route, then launch with: travel to <destination name>', 'system');
      appendLine('Launch a route with: travel to <destination name>', 'system');
      state.phase2.destinations.forEach((destination, index) => {
        const status = state.phase2.currentDestination && state.phase2.currentDestination.id === destination.id
          ? 'in-range'
          : state.phase2.travelling && state.phase2.routeId === destination.id
            ? 'in transit'
            : 'ready';
        const eta = typeof routeTravelTime === 'function' ? routeTravelTime(state, destination) : destination.travelTime;
        appendLine((index + 1) + '. ' + destination.name + ' | ' + destination.type + ' | fuel ' + routeFuelCost(state, destination) + ' | eta ' + eta + 's | hazard ' + destination.hazard + ' | ' + status, 'info');
      });
      appendLine('Tip: use "ship" to check fuel, cargo, and current route status.', 'system');
      return true;
    }

    function handleShipStatus() {
      appendLine('Ship Status', 'system');
      appendLine('Hull: ' + state.ship.hull + '/' + hullCapacity(state.ship) + ' | Shields: ' + state.ship.shields + ' | Fuel: ' + state.ship.fuel + '/' + fuelCapacity(state.ship) + ' | Credits: ' + state.ship.credits + ' | Minerals: ' + state.ship.minerals + ' | Supplies: ' + (state.ship.supplies || 0), 'info');
      appendLine('Cargo: ' + (state.ship.cargo.length ? state.ship.cargo.join(', ') : 'empty') + ' | Capacity: ' + state.ship.cargo.length + '/' + (state.ship.cargoLimit || 18), 'info');
      appendLine('Modules: ' + (state.ship.modules.join(', ') || 'none'), 'info');
      appendLine('Upgrades: engine ' + state.ship.upgrades.engine + ' | mining ' + state.ship.upgrades.mining + ' | shield ' + state.ship.upgrades.shield, 'info');
      appendLine('Frontier rank: ' + state.progression.rank + ' | Reputation: ' + state.progression.reputation + ' | Routes completed: ' + state.progression.routesCompleted, 'system');
      if (state.phase2.travelling) {
        appendLine('Route status: in transit to ' + (state.phase2.currentDestination ? state.phase2.currentDestination.name : 'destination'), 'success');
      } else if (state.phase2.locationStatus === 'orbit') {
        appendLine('Route status: in orbit above ' + (state.phase2.currentDestination ? state.phase2.currentDestination.name : 'the current route'), 'info');
      } else if (state.phase2.currentDestination) {
        appendLine('Current destination: ' + state.phase2.currentDestination.name + ' (' + state.phase2.currentDestination.type + ')', 'success');
      } else {
        appendLine('Current destination: docked in orbit', 'info');
      }
    }

    function handleModules() {
      const modules = state.ship.modules || [];
      appendLine('Installed Ship Modules', 'system');
      if (!modules.length) {
        appendLine('No modules are installed.', 'info');
        return true;
      }
      const effects = {
        nav_console: 'plots and launches routes with flight and travel commands',
        basic_scanner: 'surveys local sites and reveals resources with explore',
        fuel_cell: 'raises fuel capacity to ' + fuelCapacity(state.ship) + ' and restores fuel when installed',
        alloy_patch: 'raises hull capacity to ' + hullCapacity(state.ship) + ' and repairs hull when installed',
        emergency_supply_cache: 'opened the Phase 1 locker, granting credits, fuel, and emergency rations',
        field_repair_cache: 'restored hull integrity and expanded the oxygen reserve during Phase 1',
        survival_pack: 'provides a consumable oxygen refill; use survival pack',
        mining_laser: 'boosts mineral harvesting yield during mining actions',
        deep_scanner: 'wide-band array that expands survey precision and detection',
        shield_capacitor: 'bolsters deflector shield strength and energy absorption',
      };
      modules.forEach((module) => {
        appendLine(module.replaceAll('_', ' ') + ': ' + (effects[module] || 'installed and operational') + '.', 'info');
      });
      if ((state.ship.supplies || 0) > 0) {
        appendLine('Consumable survival packs: ' + state.ship.supplies + '. Use survival pack to restore up to 4 oxygen actions.', 'success');
      }
      return true;
    }

    function handleCargo() {
      appendLine('Ship Cargo Hold', 'system');
      const cargo = (state.ship && state.ship.cargo) || [];
      const limit = (state.ship && state.ship.cargoLimit) || 18;
      appendLine('Storage: ' + cargo.length + '/' + limit + ' slots utilized.', 'info');
      if (!cargo.length) {
        appendLine('The cargo hold is currently empty.', 'info');
      } else {
        const counts = {};
        cargo.forEach((item) => {
          counts[item] = (counts[item] || 0) + 1;
        });
        const summary = Object.entries(counts).map(([name, count]) => (count > 1 ? count + 'x ' : '') + name).join(', ');
        appendLine('Manifest: ' + summary, 'info');
        appendLine('Tip: Sell cargo at stations/planets with "trade sell cargo", or use samples in the lab for research.', 'system');
      }
      return true;
    }

    function handleMinerals() {
      appendLine('Ship Mineral Stores', 'system');
      const minerals = (state.ship && state.ship.minerals) || 0;
      appendLine('Stockpile: ' + minerals + ' units of refined minerals.', 'info');
      appendLine('Usage: Craft modules ("craft <fuel_cell|alloy_patch|mining_laser|deep_scanner|shield_capacitor>") or upgrade systems ("upgrade <engine|mining|shield|cargo>").', 'system');
      return true;
    }

    function handleUpgrades(args) {
      const command = (args || '').trim().toLowerCase();
      const definitions = upgradeDefs;

      if (!command || command === 'list') {
        appendLine('Ship Upgrades & Engineering', 'system');
        appendLine('Current levels: Engine ' + state.ship.upgrades.engine + ' | Mining ' + state.ship.upgrades.mining + ' | Shield ' + state.ship.upgrades.shield + ' | Cargo ' + (state.ship.upgrades.cargo || 1), 'info');
        Object.entries(definitions).forEach(([key, upgrade]) => {
          const currentLevel = ((state.ship.upgrades || {})[key]) || 1;
          const cost = upgrade.getCost(currentLevel);
          appendLine('- ' + upgrade.name + ' (lvl ' + currentLevel + '): ' + upgrade.description + ' [Next: ' + cost.minerals + ' minerals, ' + cost.credits + ' credits]', 'info');
        });
        appendLine('To upgrade a system, type: upgrade <engine|mining|shield|cargo>', 'system');
        return true;
      }

      if (typeof upgradeShipSystem === 'function') {
        const result = getUpgradeShipSystem(state, command);
        if (!result.success) {
          appendLine(result.reason, 'warning');
          return false;
        }
        appendLine(result.message, 'success');
        appendLine('Ship status: Minerals ' + state.ship.minerals + ' | Credits ' + state.ship.credits + ' | Engine ' + state.ship.upgrades.engine + ' | Mining ' + state.ship.upgrades.mining + ' | Shields ' + state.ship.shields + ' | Cargo Limit ' + (state.ship.cargoLimit || 18), 'info');
        return true;
      }

      appendLine('Upgrade systems are not currently responsive.', 'warning');
      return false;
    }

    function handleScan() {
      const destination = state.phase2.currentDestination;
      if (state.phase2.locationStatus === 'landed' && destination) {
        return handleExplore();
      }

      if (!(state.ship.modules || []).includes('basic_scanner')) {
        appendLine('A basic scanner module is required to perform sensor scans.', 'warning');
        return false;
      }

      appendLine('Sensor Suite — Orbital Sweep', 'system');
      if (state.phase2.travelling) {
        const route = (state.destinations || []).find((dest) => dest.id === state.phase2.routeId);
        appendLine('Active Transit Scan: Travelling to ' + (route ? route.name : 'waypoint') + '.', 'info');
        appendLine('Sublight drive frequency synchronized. Route hazard rating: ' + (route ? route.hazard : 'unknown') + '.', 'info');
        return true;
      }

      if (destination) {
        appendLine('Orbital telemetry for ' + destination.name + ' (' + destination.type + '):', 'info');
        appendLine('Hazard Level: ' + destination.hazard + ' | Biome/Profile: ' + destination.biome + ' | Legal Status: ' + destination.legalStatus, 'info');
        if (destination.type === 'asteroid' && destination.site) {
          const unrevealed = destination.site.locations.filter((loc) => !loc.revealed).length;
          appendLine('Sensor echoes: ' + unrevealed + ' unchartered seismic anomalies in the local asteroid cluster.', 'info');
        } else if (destination.type === 'planet' && destination.site) {
          const unrevealed = (destination.site.resources || []).filter((res) => !res.revealed).length;
          appendLine('Spectrometry: ' + unrevealed + ' uncatalogued surface bioliths and mineral nodes.', 'info');
        } else if (destination.type === 'station') {
          appendLine('Station traffic: Trade corridors and docking docks operating nominally.', 'info');
        }
        appendLine('Type "land" to descend to the surface site and begin operations.', 'system');
        return true;
      }

      appendLine('Deep Space Scan: Vessel in stable holding orbit above home station.', 'info');
      appendLine('Route network online. Type "flight" to view open destination vectors.', 'system');
      return true;
    }

    function handleTrade(args) {
      const destination = state.phase2.currentDestination;
      if (state.phase2.locationStatus !== 'landed' || !destination || !['station', 'planet'].includes(destination.type)) {
        appendLine('You need to arrive at a station or planet before trading.', 'warning');
        return false;
      }
      const command = (args || '').trim().toLowerCase();
      if (!command || command === 'list') {
        appendLine('Trade menu: buy oxygen (' + OXYGEN_RECHARGE_COST + ' credits for up to ' + OXYGEN_RECHARGE_AMOUNT + ' actions) | buy fuel | sell minerals | sell cargo | buy supplies', 'system');
        return true;
      }
      if (command === 'buy oxygen') {
        const oxygenToRestore = Math.min(OXYGEN_RECHARGE_AMOUNT, oxygenCapacity() - state.oxygenTurns);
        if (oxygenToRestore <= 0) {
          appendLine('Your oxygen reserve is already full.', 'info');
          return false;
        }
        if (state.ship.credits < OXYGEN_RECHARGE_COST) {
          appendLine('You need ' + OXYGEN_RECHARGE_COST + ' credits to refill your oxygen reserve.', 'warning');
          return false;
        }
        state.ship.credits -= OXYGEN_RECHARGE_COST;
        state.oxygenTurns += oxygenToRestore;
        state.gameOver = false;
        statusText();
        appendLine('You refill ' + oxygenToRestore + ' oxygen actions for ' + OXYGEN_RECHARGE_COST + ' credits. Reserve: ' + state.oxygenTurns + '/' + oxygenCapacity() + '.', 'success');
        return true;
      }
      if (command === 'buy fuel') {
        if (state.ship.fuel >= fuelCapacity(state.ship)) {
          appendLine('Your fuel tanks are already full.', 'info');
          return false;
        }
        if (state.ship.credits < 12) {
          appendLine('You do not have enough credits for fuel.', 'warning');
          return false;
        }
        state.ship.credits -= 12;
        state.ship.fuel = Math.min(fuelCapacity(state.ship), state.ship.fuel + 18);
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
        const tradeReward = getAwardProgress(state, { destinationType: destination.type, source: 'trade' });
        if (tradeReward && tradeReward.success) {
          appendLine(tradeReward.message, 'success');
        }
        appendLine('You sell your minerals for ' + payout + ' credits.', 'success');
        return true;
      }
      if (command === 'sell cargo' || command === 'sell samples' || command === 'sell goods') {
        const cargo = Array.isArray(state.ship.cargo) ? state.ship.cargo.filter((item) => item && item.trim()) : [];
        if (!cargo.length) {
          appendLine('You have no cargo or samples to sell.', 'warning');
          return false;
        }
        const payout = cargo.length * 12;
        state.ship.credits += payout;
        state.ship.cargo = [];
        appendLine('You sell your cargo and samples for ' + payout + ' credits.', 'success');
        return true;
      }
      if (command === 'buy supplies') {
        if (state.ship.credits < 10) {
          appendLine('You cannot afford the supplies here.', 'warning');
          return false;
        }
        state.ship.credits -= 10;
        state.ship.supplies = (state.ship.supplies || 0) + 1;
        appendLine('You buy one survival pack. Supplies aboard: ' + state.ship.supplies + '. Use survival pack to restore up to 4 oxygen actions.', 'success');
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

      const miningLevel = Math.max(1, ((state.ship || {}).upgrades || {}).mining || 1);
      const laserBonus = (state.ship.modules || []).includes('mining_laser') ? 1 : 0;
      const bonus = (miningLevel - 1) + laserBonus;

      if (destination.type === 'asteroid') {
        const site = destination.site;
        const oreLocation = site && site.locations.find((location) => location.kind === 'ore' && location.revealed && location.mineralsRemaining > 0);
        if (!oreLocation) {
          appendLine('No surveyed ore seam is ready to mine. Explore the field to find one.', 'warning');
          return false;
        }
        const gain = Math.min(2 + bonus, oreLocation.mineralsRemaining);
        oreLocation.mineralsRemaining -= gain;
        state.ship.minerals += gain;
        appendLine('You mine ' + gain + ' minerals from the ' + oreLocation.name + '. ' + oreLocation.mineralsRemaining + ' remain in the seam.', 'success');
        return true;
      }

      const site = destination.site;
      if (!site || !Array.isArray(site.resources)) {
        appendLine('The terrain here offers no harvestable deposits.', 'warning');
        return false;
      }
      const resource = site.resources.find((entry) => entry.revealed && entry.mineralsRemaining > 0);
      if (!resource) {
        appendLine('This biome has already been surveyed. Explore again to locate a fresh seam or sample site.', 'warning');
        return false;
      }
      if (resource.kind === 'sample' && state.ship.cargo.length >= (state.ship.cargoLimit || 18)) {
        appendLine('Your cargo bay is full. Sell or trade before harvesting ' + resource.name + '.', 'warning');
        return false;
      }
      const gain = Math.min(3 + bonus, resource.mineralsRemaining);
      resource.mineralsRemaining -= gain;
      state.ship.minerals += gain;
      if (resource.kind === 'sample') {
        state.ship.cargo.push(resource.name);
        appendLine('You harvest a ' + resource.name + ' and recover ' + gain + ' minerals from nearby deposits.', 'success');
      } else {
        appendLine('You mine ' + gain + ' minerals from the ' + resource.name + '.', 'success');
      }
      return true;
    }

    function handleExplore() {
      const destination = state.phase2.currentDestination;
      if (state.phase2.locationStatus !== 'landed' || !destination) {
        appendLine('You need to be on a destination site before you can explore.', 'warning');
        return false;
      }
      if (!(state.ship.modules || []).includes('basic_scanner')) {
        appendLine('A basic scanner module is required to survey destinations.', 'warning');
        return false;
      }
      if (destination.type === 'planet') {
        const site = destination.site || { resources: [] };
        const remaining = site.resources.find((entry) => !entry.revealed);
        if (!remaining) {
          appendLine('You have fully surveyed the ' + destination.biome + ' terrain. Nothing new remains to extract here.', 'info');
          return false;
        }
        const sampleName = remaining.name;
        if (state.ship.cargo.length >= (state.ship.cargoLimit || 18)) {
          appendLine('Your cargo bay is full. Sell or trade before gathering more ' + sampleName + '.', 'warning');
          return false;
        }
        remaining.revealed = true;
        state.ship.cargo.push(sampleName);
        appendLine('You survey the ' + destination.biome + ' terrain and reveal a ' + sampleName + '.', 'success');
        return true;
      }
      if (destination.type === 'station') {
        const site = destination.site || {};
        if (site.explored) {
          appendLine('You have already surveyed this station. Its vendors and trade floor are mapped.', 'info');
          return false;
        }
        site.explored = true;
        state.ship.credits += 8;
        const reward = getAwardProgress(state, { destinationType: 'station', source: 'explore' });
        appendLine('You survey the station arcades, docks, and trade floors. The market contact pays 8 credits for your current route data.', 'success');
        if (reward && reward.success) appendLine(reward.message, 'success');
        return true;
      }
      if (destination.type === 'asteroid') {
        const site = destination.site;
        const location = site && site.locations.find((entry) => !entry.revealed);
        if (!location) {
          appendLine('Your survey has covered every point of interest in this field.', 'info');
          return false;
        }
        location.revealed = true;
        if (location.kind === 'ore') {
          appendLine('Survey complete: ' + location.name + ' contains ' + location.mineralsRemaining + ' mineable minerals.', 'success');
        } else {
          location.collected = true;
          state.ship.credits += location.credits;
          appendLine('You uncover a ' + location.name + ' and recover ' + location.credits + ' credits in salvage.', 'success');
        }
        return true;
      }
      appendLine('You survey the site and find no further points of interest.', 'info');
      return true;
    }

    function handleCraft(args) {
      const recipeId = (args || '').trim().toLowerCase();
      if (!recipeId) {
        appendLine('Craft what? Available recipes: fuel_cell, alloy_patch, mining_laser, deep_scanner, shield_capacitor', 'system');
        return false;
      }
      const result = craftItem(state, recipeId);
      if (!result.success) {
        appendLine(result.reason, 'warning');
        return false;
      }
      appendLine(result.message, 'success');
      appendLine('Ship status: fuel ' + state.ship.fuel + ' | minerals ' + state.ship.minerals + ' | hull ' + state.ship.hull, 'info');
      return true;
    }

    function handleFlightRoute(input) {
      if (!state.gameWon) {
        appendLine('Repair the ship with the flux core before launching into Phase 2.', 'warning');
        return false;
      }
      if (!(state.ship.modules || []).includes('nav_console')) {
        appendLine('The navigation console module is required to plot routes.', 'warning');
        return false;
      }

      // Auto-board when landed so the player doesn't need to type 'board' first
      if (state.phase2.locationStatus === 'landed') {
        const prevDest = state.phase2.currentDestination;
        state.phase2.locationStatus = 'orbit';
        state.phase2.activeZone = null;
        state.currentRoom = 'commandDeck';
        if (prevDest) {
          appendLine('Auto-boarding ship. Departing orbit above ' + prevDest.name + '.', 'system');
        }
      }

      const routeName = normalizeTravelDestination(input);
      if (!routeName) {
        appendLine('Specify a destination name to travel to.', 'warning');
        return false;
      }
      const destination = state.phase2.destinations.find((item) => item.name.toLowerCase() === routeName.toLowerCase() || item.id.toLowerCase() === routeName.toLowerCase());
      if (!destination) {
        appendLine('No route matches ' + routeName + '. Use the flight console list to choose a destination.', 'warning');
        return false;
      }
      const started = startFlight(state, destination.id, (arrivedDestination) => {
        appendLine('Arrival confirmed: ' + arrivedDestination.name + '. You are now at the ' + arrivedDestination.type + ' site.', 'system');
        appendLine('Hazard: ' + arrivedDestination.hazard + '. Reward: ' + arrivedDestination.reward + '.', 'info');
        const reward = getAwardProgress(state, { destinationType: arrivedDestination.type, source: 'route' });
        if (reward && reward.success) {
          appendLine(reward.message, 'success');
        } else if (reward) {
          appendLine('Route logged. ' + reward.message, 'system');
        }
        // Discover new destinations when unvisited count drops low
        const unvisited = (state.phase2.destinations || []).filter(function(d) { return !d.visited; });
        if (unvisited.length <= 1 && typeof discoverNewDestinations === 'function') {
          const newDests = discoverNewDestinations(state, 3);
          if (newDests.length > 0) {
            appendLine('Long-range sensors detect ' + newDests.length + ' uncharted signals in this sector.', 'system');
            newDests.forEach(function(d) {
              appendLine('  > ' + d.name + ' (' + d.type + ') — ' + d.summary, 'info');
            });
          }
        }
        renderRoom();
      });
      if (!started.traveling) {
        appendLine(started.reason, 'warning');
        return false;
      }
      const eta = started.travelTime || destination.travelTime;
      appendLine('Route plotted to ' + destination.name + '. Departure window open. Estimated arrival: ' + eta + ' seconds.', 'system');
      appendLine('Fuel burn: ' + started.fuelCost + '. The ship is now in transit.', 'info');
      appendLine('While in transit, you can craft, inspect modules, or check ship status.', 'info');
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
      appendLine('You board the ship and return to orbit above ' + destination.name + '.', 'success');
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
      appendLine('Descent complete. The ship anchors at ' + destination.name + ', and the ' + destination.type + ' site is now active.', 'success');
      appendLine('You can now explore, mine, trade, or return to orbit as needed.', 'info');
      renderRoom();
      return true;
    }

    return {
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
    };
  }

  return { createSpaceCommands };
});
