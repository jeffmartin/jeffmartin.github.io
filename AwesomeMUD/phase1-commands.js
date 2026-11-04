(function (root, factory) {
  const phaseOneCommands = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = phaseOneCommands;
  } else {
    root.DeepDriftPhaseOne = phaseOneCommands;
  }
})(globalThis, function () {
  function createPhaseOneCommands({ state, rooms, appendLine, updateMapDisplay, statusText, renderRoom, fuelCapacity, hullCapacity, awardProgress, oxygenCapacity, handleFlight, handleScan }) {
    function getOxygenCapacity() {
      if (typeof oxygenCapacity === 'function') return oxygenCapacity();
      return 18 + (state.crewSaved ? 4 : 0) + (state.systemsRepaired ? 4 : 0);
    }

    function handleTake(itemName) {
      if (!itemName) {
        appendLine('Take what?', 'warning');
        return false;
      }
      const normalized = itemName.trim().toLowerCase();
      if (state.currentRoom === 'maintenanceCorridor' && ['spare parts', 'parts'].includes(normalized)) {
        if (state.sparePartsSalvaged) {
          appendLine("You've already salvaged all usable components from the spare parts bin.", 'info');
          return false;
        }
        state.sparePartsSalvaged = true;
        state.ship = state.ship || { minerals: 0 };
        state.ship.minerals = (state.ship.minerals || 0) + 3;
        appendLine('You salvage intact alloy plating and copper conduit from the spare parts bin, adding 3 minerals to your ship stores.', 'success');
        return true;
      }

      const room = rooms[state.currentRoom];
      const item = (room.items || []).find((entry) => entry.toLowerCase() === normalized);
      if (!item) {
        appendLine('You do not see a ' + itemName + ' here.', 'warning');
        return false;
      }
      room.items = room.items.filter((entry) => entry !== item);
      state.inventory.push(item);
      appendLine('You take the ' + item + '.', 'system');
      updateMapDisplay();
      return true;
    }

    function handleDrop(itemName) {
      if (!itemName) {
        appendLine('Drop what?', 'warning');
        return false;
      }
      const normalized = itemName.trim().toLowerCase();
      const index = state.inventory.findIndex((entry) => entry.toLowerCase() === normalized);
      if (index < 0) {
        appendLine('You are not carrying a ' + itemName + '.', 'warning');
        return false;
      }
      const [dropped] = state.inventory.splice(index, 1);
      const room = rooms[state.currentRoom];
      if (room) {
        room.items = room.items || [];
        room.items.push(dropped);
      }
      appendLine('You drop the ' + dropped + '.', 'system');
      updateMapDisplay();
      renderRoom();
      return true;
    }

    function handleSalvage(target) {
      const normalized = (target || '').trim().toLowerCase();
      if (state.currentRoom === 'maintenanceCorridor' && (!normalized || ['parts', 'spare parts', 'scrap', 'bin', 'spare'].includes(normalized))) {
        if (state.sparePartsSalvaged) {
          appendLine('The spare parts bin has already been stripped of usable materials.', 'info');
          return false;
        }
        state.sparePartsSalvaged = true;
        state.ship = state.ship || { minerals: 0 };
        state.ship.minerals = (state.ship.minerals || 0) + 3;
        appendLine('You strip usable copper windings and titanium scrap from the spare parts bin (+3 minerals).', 'success');
        return true;
      }
      appendLine('There is nothing here that you can salvage.', 'warning');
      return false;
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

      const normalized = itemName.trim().toLowerCase();
      const inInventory = state.inventory.some((item) => item.toLowerCase() === normalized);

      if (['nav console', 'nav_console', 'navigation console', 'flight console', 'flight'].includes(normalized)) {
        if (state.currentRoom === 'commandDeck') {
          if (typeof handleFlight === 'function') return handleFlight();
          appendLine('The flight console hums with navigation coordinates.', 'system');
          return true;
        }
        appendLine('The navigation console is located on the Command Deck.', 'info');
        return false;
      }

      if (['basic scanner', 'basic_scanner', 'scanner'].includes(normalized)) {
        if (typeof handleScan === 'function') return handleScan();
        appendLine('The ship scanner sweeps the sector for contacts and mineral deposits.', 'system');
        return true;
      }

      if (['emergency_supply_cache', 'emergency supply cache'].includes(normalized)) {
        appendLine('The emergency supply cache has already been distributed into ship credits, fuel, and rations.', 'info');
        return true;
      }

      if (['field_repair_cache', 'field repair cache'].includes(normalized)) {
        appendLine('The field repair cache is maintaining secondary life support integrity.', 'info');
        return true;
      }

      if (['mining_laser', 'mining laser'].includes(normalized)) {
        appendLine('The mining laser booster is active, amplifying ore harvesting yield during mine actions.', 'info');
        return true;
      }

      if (['deep_scanner', 'deep scanner'].includes(normalized)) {
        appendLine('The deep scanner array is active, providing high-resolution orbital and surface data.', 'info');
        return true;
      }

      if (['shield_capacitor', 'shield capacitor'].includes(normalized)) {
        appendLine('The shield capacitor is online, buffering energy for deflector screens.', 'info');
        return true;
      }

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
        appendLine(ending.title + ': ' + ending.description, 'success');
        updateMapDisplay();
        return true;
      }

      if (state.currentRoom === 'airlock' && normalized === 'oxygen key') {
        if (!inInventory) {
          appendLine('You do not have an oxygen key.', 'warning');
          return false;
        }
        state.ship = state.ship || { modules: [], cargo: [], fuel: 90, credits: 45 };
        state.ship.modules = state.ship.modules || [];
        state.ship.cargo = state.ship.cargo || [];
        if (state.ship.modules.includes('emergency_supply_cache')) {
          appendLine('The emergency supply locker is already open and its cache has been claimed.', 'info');
          return false;
        }
        state.ship.modules.push('emergency_supply_cache');
        state.ship.cargo.push('emergency rations');
        state.ship.credits = (state.ship.credits || 45) + 15;
        state.ship.fuel = Math.min(fuelCapacity(state.ship), (state.ship.fuel || 90) + 12);
        state.inventory = state.inventory.filter((item) => item.toLowerCase() !== 'oxygen key');
        appendLine('You unlock the emergency supply locker with the oxygen key. Inside, you find ration packs and a cached repair kit.', 'system');
        appendLine('The cache is marked for ship use. Emergency rations and a small fuel reserve are now in your ship stores.', 'success');
        appendLine('This gives the ship a permanent head start once you launch back into Phase 2.', 'info');
        updateMapDisplay();
        return true;
      }

      if (state.currentRoom === 'dockingBay' && normalized === 'fuel cell') {
        if (!inInventory) {
          appendLine('You do not have a fuel cell.', 'warning');
          return false;
        }
        state.ship = state.ship || { modules: [], fuel: 90 };
        state.ship.modules = state.ship.modules || [];
        if (!state.ship.modules.includes('fuel_cell')) {
          state.ship.modules.push('fuel_cell');
          state.ship.fuel = Math.min(fuelCapacity(state.ship), (state.ship.fuel || 0) + 12);
          appendLine("You install the fuel cell in the shuttle's auxiliary power port. Its lights come on, letting you access the flight logs, and the ship gains a fuel-capacity module.", 'success');
        } else {
          appendLine('The ship already has a fuel-cell module installed. You use the shuttle power to access its flight logs.', 'info');
        }
        state.inventory = state.inventory.filter((item) => item.toLowerCase() !== 'fuel cell');
        appendLine('The last entry reads: "Reactor critical. All hands to emergency stations."', 'info');
        updateMapDisplay();
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
        state.oxygenTurns += 4;
        state.inventory = state.inventory.filter((item) => item.toLowerCase() !== 'medkit');
        appendLine('Dr. Chen shares emergency oxygen: +4 actions.', 'success');
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
        state.ship = state.ship || { modules: [], cargo: [], fuel: 90, credits: 45 };
        state.ship.modules = state.ship.modules || [];
        if (!state.ship.modules.includes('field_repair_cache')) {
          state.ship.modules.push('field_repair_cache');
        }
        state.ship.hull = Math.min(hullCapacity(state.ship), (state.ship.hull || 100) + 10);
        state.oxygenTurns += 4;
        state.inventory = state.inventory.filter((item) => item.toLowerCase() !== 'repair patch');
        appendLine('Restored life support expands your oxygen reserve: +4 actions.', 'success');
        updateMapDisplay();
        return true;
      }

      if (normalized === 'emergency rations' || normalized === 'survival pack' || normalized === 'survival_pack') {
        const supplyCount = (state.ship && state.ship.supplies) || 0;
        const cargoHasSupply = Array.isArray(state.ship && state.ship.cargo) && state.ship.cargo.some((item) => item.toLowerCase() === 'survival pack' || item.toLowerCase() === 'emergency rations');
        const inventorySupplyIndex = state.inventory.findIndex((item) => item.toLowerCase() === 'emergency rations');
        if (supplyCount <= 0 && !cargoHasSupply && inventorySupplyIndex < 0) {
          appendLine('You do not have a usable survival pack or ration cache aboard the ship.', 'warning');
          return false;
        }
        if (state.oxygenTurns >= getOxygenCapacity()) {
          appendLine('Your oxygen reserve is already full. Save the supplies for a longer sortie.', 'info');
          return false;
        }
        state.ship = state.ship || { modules: [], cargo: [], fuel: 90, credits: 45 };
        state.ship.cargo = state.ship.cargo || [];
        if (supplyCount > 0) {
          state.ship.supplies -= 1;
        } else if (inventorySupplyIndex >= 0) {
          state.inventory.splice(inventorySupplyIndex, 1);
          updateMapDisplay();
        } else {
          const index = state.ship.cargo.findIndex((item) => item.toLowerCase() === 'survival pack' || item.toLowerCase() === 'emergency rations');
          if (index >= 0) state.ship.cargo.splice(index, 1);
        }
        state.oxygenTurns = Math.min(getOxygenCapacity(), state.oxygenTurns + 4);
        state.gameOver = state.oxygenTurns <= 0;
        statusText();
        appendLine('You consume the emergency supplies and stabilize the ship reserve. Oxygen +4 actions.', 'success');
        return true;
      }

      const cargoSampleIndex = (state.ship && Array.isArray(state.ship.cargo))
        ? state.ship.cargo.findIndex((entry) => entry && entry.toLowerCase() === normalized)
        : -1;
      if (cargoSampleIndex >= 0) {
        const sampleName = state.ship.cargo[cargoSampleIndex];
        state.ship.cargo.splice(cargoSampleIndex, 1);
        state.ship.credits = (state.ship.credits || 0) + 6;
        if (typeof awardProgress === 'function') {
          const progressReward = awardProgress(state, { destinationType: 'station', source: 'explore' });
          appendLine('You analyze the ' + sampleName + ' in the ship research station (+6 credits).', 'success');
          if (progressReward && progressReward.success) appendLine(progressReward.message, 'success');
        } else {
          appendLine('You analyze the ' + sampleName + ' in the ship research station (+6 credits).', 'success');
        }
        return true;
      }

      if (inInventory) {
        if (normalized === 'flux core') {
          appendLine('The flux core must be slotted into the navigation console on the Command Deck to restart the ship.', 'info');
          return false;
        }
        if (normalized === 'oxygen key') {
          appendLine('The oxygen key belongs to the emergency supply locker in the Airlock.', 'info');
          return false;
        }
        if (normalized === 'fuel cell') {
          appendLine('The fuel cell can be installed in the shuttle power port in the Docking Bay.', 'info');
          return false;
        }
        if (normalized === 'medkit') {
          appendLine('The medkit has trauma supplies for wounded crew. Use it in the Observation Deck to respond to Dr. Chen.', 'info');
          return false;
        }
        if (normalized === 'repair patch') {
          appendLine('The repair patch is designed to seal damaged conduits like the pressure leak in Maintenance.', 'info');
          return false;
        }
        appendLine('You try to use the ' + itemName + ", but there's nothing here to use it on.", 'info');
        return false;
      }

      appendLine('You do not have a ' + itemName + '.', 'warning');
      return false;
    }

    function handleMove(direction) {
      const room = rooms[state.currentRoom];
      const target = room.exits[direction];
      if (!target) {
        appendLine('You cannot go ' + direction + ' from here.', 'warning');
        return false;
      }
      state.currentRoom = target;
      appendLine('You move ' + direction + '.', 'system');
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
      appendLine('Commands: look, inventory, take <item>, drop <item>, use <item>, go <direction>, examine <subject>, scan, flight, travel to <destination>, board, land, explore, mine, trade, craft <item>, upgrade <system>, ship, modules, cargo, minerals, status, progress, rank, help, save, load, reset, map.', 'system');
    }

    function handleExamine(subject) {
      if (!subject) {
        appendLine('Examine what?', 'warning');
        return false;
      }
      const normalized = subject.trim().toLowerCase();

      const shipModules = (state.ship && state.ship.modules) || [];
      const moduleDescriptions = {
        nav_console: 'The navigation console plots interplanetary travel routes and links with destination navigational beacons.',
        basic_scanner: 'Standard orbital and surface sensor suite. Surveys asteroid fields, stations, and planetary landing sites.',
        fuel_cell: 'Auxiliary deuterium fuel module. Expands ship fuel capacity to ' + fuelCapacity(state.ship) + ' units and provides backup reserves.',
        alloy_patch: 'Reinforced titanium-carbide hull plating. Raises ship hull capacity to ' + hullCapacity(state.ship) + ' and seals structural fractures.',
        emergency_supply_cache: 'Emergency cache unsealed from the airlock locker. Provided reserve credits, emergency fuel, and rations.',
        field_repair_cache: 'Field repair cache established during life support restoration. Reinforced hull and expanded oxygen reserve.',
        mining_laser: 'High-frequency pulsed mining laser. Enhances mineral yield from asteroid seams and planetary strata.',
        deep_scanner: 'Wide-band resonance scanner array. Detects hidden mineral seams and deep planetary specimens.',
        shield_capacitor: 'High-density shield capacitor. Bolsters deflector shield strength and energy absorption.',
        survival_pack: 'Consumable survival pack. Restores up to 4 oxygen actions when consumed.',
      };

      for (const [modKey, modDesc] of Object.entries(moduleDescriptions)) {
        if (normalized === modKey || normalized === modKey.replaceAll('_', ' ') || normalized === modKey.replaceAll('_', ' ') + ' module') {
          if (shipModules.includes(modKey)) {
            appendLine(modDesc, 'info');
            return true;
          }
        }
      }

      const cargoItems = (state.ship && state.ship.cargo) || [];
      const cargoMatch = cargoItems.find((entry) => entry && entry.toLowerCase() === normalized);
      if (cargoMatch) {
        const sampleDescriptions = {
          'biotic specimen': 'A preserved biological sample of alien flora or tissue, highly valued by research stations. Can be analyzed on ship or sold at stations.',
          'geode shard': 'A crystalline mineral fragment with iridescent internal refractions, prized by gemologists and station jewelers.',
          'deepwater sample': 'A sealed vial of pressurized liquid containing extremophile micro-organisms from oceanic depths.',
          'dryland sample': 'A desiccated core sample of exotic planetary soil rich in rare isotopes.',
          'emergency rations': 'A sealed emergency ration pack from ship stores. Use it to restore up to 4 oxygen actions.',
          'survival pack': 'An emergency survival canister containing nutrient paste and high-purity compressed oxygen. Use it to restore up to 4 oxygen actions.',
        };
        appendLine(sampleDescriptions[cargoMatch.toLowerCase()] || ('A harvested resource in your cargo bay: ' + cargoMatch + '.'), 'info');
        return true;
      }

      if (state.currentRoom === 'airlock') {
        if (['map', 'star map', 'chart'].includes(normalized)) {
          appendLine('The faded chart marks the docking bay, maintenance corridor, and command deck. The route grid is available from the command deck.', 'info');
          return true;
        }
        if (['hatch', 'airlock hatch', 'outer hatch'].includes(normalized)) {
          appendLine('The heavy pressure hatch is sealed tight against vacuum, leading north toward the Docking Bay.', 'info');
          return true;
        }
        if (['wall', 'walls', 'bulkhead'].includes(normalized)) {
          appendLine('Reinforced titanium-alloy bulkhead panels line the airlock walls.', 'info');
          return true;
        }
        if (['oxygen', 'air', 'atmosphere'].includes(normalized)) {
          appendLine("The airlock atmosphere is thin and metallic, kept breathable by the ship's recycled life support system.", 'info');
          return true;
        }
        if (['locker', 'supply locker', 'emergency supply locker'].includes(normalized)) {
          if ((state.ship && state.ship.modules || []).includes('emergency_supply_cache')) {
            appendLine('The emergency supply locker is open. Its emergency rations and cached supplies have already been claimed for ship stores.', 'info');
          } else {
            appendLine('A reinforced emergency supply locker set into the bulkhead. It requires an oxygen key to unlock.', 'info');
          }
          return true;
        }
      }

      if (state.currentRoom === 'dockingBay') {
        if (['crates', 'cargo', 'cargo crates'].includes(normalized)) {
          appendLine('The cargo is locked to the deck and registered to the abandoned shuttle. The loose fuel cell is the only recoverable equipment.', 'info');
          return true;
        }
        if (['shuttle'].includes(normalized)) {
          if ((state.ship && state.ship.modules || []).includes('fuel_cell')) {
            appendLine("The shuttle's auxiliary systems hum softly, powered by the installed fuel cell. The cockpit console displays flight logs.", 'info');
          } else {
            appendLine('The shuttle is pristine but disabled. Its flight computer might have logs...', 'system');
            appendLine(state.inventory.some((item) => item.toLowerCase() === 'fuel cell')
              ? 'If only you had power... A fuel cell might work.'
              : "You'll need a fuel cell to power it up.", 'info');
          }
          return true;
        }
        if (['logs', 'shuttle logs', 'flight logs'].includes(normalized)) {
          if ((state.ship && state.ship.modules || []).includes('fuel_cell')) {
            appendLine('Shuttle flight log: "Reactor critical. All hands to emergency stations. Doctor Chen trapped near med bay; distress transponder engaged."', 'info');
          } else {
            appendLine('The shuttle avionics are unpowered. A fuel cell is required to boot the flight computer.', 'info');
          }
          return true;
        }
        if (['drones', 'customs drones'].includes(normalized)) {
          appendLine('Automated docking drones hover in magnetic cradles overhead, their beacons cycling amber in standby mode.', 'info');
          return true;
        }
      }

      if (state.currentRoom === 'habitatRing') {
        if (['domes', 'glass domes'].includes(normalized)) {
          appendLine('Curved armaglass domes reveal the silent expanse of space. Faint nebular dust drifts past the hull.', 'info');
          return true;
        }
        if (['pods', 'sleep pods'].includes(normalized)) {
          appendLine('Cryo-stasis sleep pods for the crew. Emergency ejection protocols were triggered; all pods are empty.', 'info');
          return true;
        }
        if (['light', 'green light'].includes(normalized)) {
          appendLine('Low-energy emergency glow strips embedded in the corridor floor cast a tranquil emerald hue.', 'info');
          return true;
        }
      }

      if (state.currentRoom === 'observationDeck') {
        if (['beacon', 'monitor', 'signal'].includes(normalized)) {
          if (state.crewSaved) {
            appendLine("The emergency monitor now shows a stable medical bay telemetry feed. Dr. Chen's vitals are green and navigational guidance data is linked to your console.", 'info');
          } else {
            appendLine('The distress beacon pulses with an intermittent signal. You pick up a voice transmission.', 'system');
            appendLine('"...Deep Drift to any listening... Dr. Chen, medical officer. Reactor critical. Need... need help."', 'info');
            appendLine('The beacon is still active. Someone is waiting for you.', 'system');
          }
          return true;
        }
        if (['windows', 'observation windows'].includes(normalized)) {
          appendLine('Heavy reinforced viewports offer a panoramic view of the debris field. Jagged rock fragments tumble past.', 'info');
          return true;
        }
        if (['debris', 'asteroid debris'].includes(normalized)) {
          appendLine('A dense cluster of micrometeorites and shattered asteroid rock orbiting the vessel.', 'info');
          return true;
        }
        if (['space', 'deep space'].includes(normalized)) {
          appendLine('The endless expanse of the deep frontier stretches outward, speckled with distant star clusters.', 'info');
          return true;
        }
      }

      if (state.currentRoom === 'commandDeck') {
        if (['console', 'nav console', 'display', 'flight console'].includes(normalized)) {
          if (state.gameWon) {
            appendLine('The navigation console pulses with bright blue telemetry. Sublight drives and hyper-jump routes are online. The galaxy map is live and ready for flight commands.', 'success');
          } else {
            appendLine('The navigation console is dark. Its status display flickers weakly, showing: "REACTOR OFFLINE - CRITICAL ERROR".', 'system');
            appendLine("It will need the reactor's flux core to restart the ship.", 'info');
          }
          return true;
        }
        if (['panels', 'control panels'].includes(normalized)) {
          appendLine('Rows of backlit switches, diagnostic gauges, and system status readouts for helm, life support, and propulsion.', 'info');
          return true;
        }
        if (['comms', 'communications'].includes(normalized)) {
          appendLine('The long-range subspace transceiver crackles with ambient cosmic radiation and station chatter from nearby systems.', 'info');
          return true;
        }
        if (['grid', 'navigation grid'].includes(normalized)) {
          appendLine('A 3D astrogation grid mapping nearby sectors, asteroid fields, outposts, and planets.', 'info');
          return true;
        }
      }

      if (state.currentRoom === 'reactorCore') {
        if (['core', 'light', 'chamber'].includes(normalized)) {
          const roomHasFluxCore = (rooms.reactorCore.items || []).some((item) => item.toLowerCase() === 'flux core');
          if (roomHasFluxCore) {
            appendLine('The reactor core glows with an unstable hum. At its center, a crystalline flux core sits mounted in a harness.', 'system');
            appendLine('It looks like exactly what the command deck needs.', 'info');
          } else {
            appendLine('The reactor chamber hums with residual thermal energy. The central harness stands empty where the flux core was removed.', 'info');
          }
          return true;
        }
        if (['harness', 'magnetic harness'].includes(normalized)) {
          appendLine('A heavy magnetic locking harness designed to stabilize and channel the high-energy flux core.', 'info');
          return true;
        }
      }

      if (state.currentRoom === 'maintenanceCorridor') {
        if (['panel', 'emergency panel', 'hatch', 'access hatch'].includes(normalized)) {
          if (state.systemsRepaired) {
            appendLine('The access hatch is securely sealed and the emergency panel glows steady green. Life support conduits are holding pressure.', 'info');
          } else {
            appendLine('The access hatch is sealed by the pressure leak. Repair the damaged conduit with the repair patch to stabilize life support.', 'info');
          }
          return true;
        }
        if (['spare parts', 'parts', 'scrap'].includes(normalized)) {
          if (state.sparePartsSalvaged) {
            appendLine('The scrap bin has been picked clean of all usable materials.', 'info');
          } else {
            appendLine('A pile of discarded conduit couplings, wire harnesses, and alloy plating scrap. You can take or salvage them for raw minerals.', 'info');
          }
          return true;
        }
        if (['cabinets', 'service cabinets'].includes(normalized)) {
          appendLine('Steel service lockers containing basic maintenance spanners, cable ties, and thermal sealant.', 'info');
          return true;
        }
        if (['pipes', 'utility pipes'].includes(normalized)) {
          appendLine('High-pressure coolant and atmosphere conduits running along the ceiling spine.', 'info');
          return true;
        }
        if (['compartment', 'damaged compartment', 'sparks'].includes(normalized)) {
          if (state.systemsRepaired) {
            appendLine('The conduit has been neatly patched with the composite repair plate. No further sparks or leaks detected.', 'info');
          } else {
            appendLine('A damaged power conduit arcs violently against the bulkhead, venting life support atmosphere.', 'warning');
          }
          return true;
        }
      }

      if (state.currentRoom === 'crewQuarters') {
        if (['rations', 'emergency rations'].includes(normalized)) {
          appendLine('The sealed emergency ration pack is safe to consume. Use it to restore up to 4 oxygen actions.', 'info');
          return true;
        }
        if (['roster', 'panel', 'names'].includes(normalized)) {
          appendLine('The wall panel shows the crew manifest. Most entries have been scratched or marked "DECEASED".', 'system');
          appendLine('Only one name remains: "Dr. Sarah Chen - Medical Officer - Last Known Location: Medical Bay".', 'info');
          return true;
        }
        if (['effects', 'personal effects'].includes(normalized)) {
          appendLine('Scattered personal datashards, photographs, and unread letters from home left behind during the evacuation.', 'info');
          return true;
        }
      }

      if (['oxygen key', 'key'].includes(normalized)) {
        appendLine('A stamped steel bypass key for the emergency life support and supply locker in the Airlock.', 'info');
        return true;
      }
      if (['fuel cell'].includes(normalized)) {
        appendLine('A high-density fuel canister filled with stabilized deuterium reactant, used to power auxiliary shuttle craft or ship engines.', 'info');
        return true;
      }
      if (['medkit'].includes(normalized)) {
        appendLine('A compact trauma kit stocked with coagulant sprays, burn dressings, and respiratory stimulants.', 'info');
        return true;
      }
      if (['repair patch'].includes(normalized)) {
        appendLine('A magnetic polymer patch capable of withstanding extreme pressure and vacuum differentials.', 'info');
        return true;
      }
      if (['flux core'].includes(normalized)) {
        appendLine('A crystalline quantum power cell humming with intense radiant energy. Slotting this into the nav console will restore main ship power.', 'info');
        return true;
      }
      if (['emergency rations'].includes(normalized)) {
        appendLine('A sealed military-grade nutrient ration pack. High caloric density and oxygen-bonding compounds; use it to restore up to 4 oxygen actions.', 'info');
        return true;
      }

      appendLine('You see nothing special about that.', 'info');
      return false;
    }

    return { handleTake, handleDrop, handleSalvage, handleUse, handleMove, handleHelp, handleExamine };
  }

  return { createPhaseOneCommands };
});
