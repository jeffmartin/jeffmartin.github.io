(function (root, factory) {
  const gameWorld = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = gameWorld;
  } else {
    root.DeepDriftWorld = gameWorld;
  }
})(globalThis, function () {
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
      items: [],
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
      items: ['emergency rations'],
    },
  };

  const initialRoomItems = Object.fromEntries(
    Object.entries(rooms).map(([roomId, room]) => [roomId, [...room.items]]),
  );

  const MAX_OXYGEN_TURNS = 18;
  const SIDE_QUEST_OXYGEN_REWARD = 4;
  const OXYGEN_RECHARGE_INTERVAL_MS = 20000;

  function oxygenCapacity(state) {
    return MAX_OXYGEN_TURNS
      + (state.crewSaved ? SIDE_QUEST_OXYGEN_REWARD : 0)
      + (state.systemsRepaired ? SIDE_QUEST_OXYGEN_REWARD : 0);
  }

  function rechargeOxygen(state) {
    const previousOxygen = state.oxygenTurns;
    state.oxygenTurns = Math.min(oxygenCapacity(state), state.oxygenTurns + 1);
    if (state.oxygenTurns > 0) state.gameOver = false;
    return state.oxygenTurns - previousOxygen;
  }

  return {
    rooms,
    initialRoomItems,
    MAX_OXYGEN_TURNS,
    SIDE_QUEST_OXYGEN_REWARD,
    OXYGEN_RECHARGE_INTERVAL_MS,
    oxygenCapacity,
    rechargeOxygen,
  };
});