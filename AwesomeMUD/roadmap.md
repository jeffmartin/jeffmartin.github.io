## Phase 2 Roadmap: Open-Space Exploration Campaign

This version should feel like a text-first, generator-driven “explorer sim” rather than a room puzzle with a launch layer. The core idea is:

- You stay in the ship and command it from the command deck.
- The galaxy is generated procedurally, not hardcoded.
- Destinations are not fixed nodes; they are generated world states.
- You travel with real time and fuel costs.
- Exploration happens both on the ship and on planets/stations/asteroid fields.
- Combat, crafting, and economy all support a broader sand-box loop.

---

## 1) Core Design Direction

### The game loop
1. Start in the ship
2. Go to command deck
3. Open flight interface
4. Select destination from generated galaxy map
5. Launch with fuel/time cost
6. Travel for real time
7. Arrive at a generated location
8. Exit ship and explore
9. Gather resources, trade, fight, or craft
10. Return to ship and continue

This should be the main loop, not a static “chaptered” campaign.

---

## 2) Build in Milestones

### Milestone 1: Ship command deck and travel system
Goal: make the ship navigable, with real-time travel and minimal player friction.

Features:
- Command deck interface
- Flight menu with destination categories:
  - asteroid belt
  - space station
  - planet
  - anomaly / hostile cluster (optional later)
- Fuel system with meaningful but not punishing limits
- Travel time based on:
  - distance
  - route hazard
  - engine quality
  - weather/space debris
- Ship status screen:
  - hull
  - fuel
  - cargo
  - minerals
  - crew
  - engine efficiency
- Travel log / event feed

Important:
- Travel should take time, not instant teleportation.
- While traveling, the player should still be able to do ship-side activities:
  - craft
  - inventory management
  - ship maintenance
  - upgrade planning
  - conversation with crew/AI

---

### Milestone 2: Procedural galaxy generation
Goal: the universe should not be a fixed list of scripted worlds.

World generation rules:
- Generate star systems with:
  - name
  - economy type
  - resource density
  - hazard level
  - political alignment
  - nearby trade routes
- Generate destination types:
  - asteroid belt
  - mining colony
  - trade station
  - habitable planet
  - gas giant moon
  - ruin / anomaly / black site (later)
- Each destination gets a generated summary:
  - danger
  - value
  - access restrictions
  - population
  - mining potential
  - intelligence presence

Use a seed-based system so worlds can be regenerated or re-seeded without hardcoding.

Example fields:
- systemId
- locationType
- threatLevel
- resourceProfile
- legalStatus
- populationBand
- knownEvents

This is the place to keep the “non-deterministic space” feel.

---

### Milestone 3: Local exploration model
Goal: once you arrive, exploration becomes a second game layer.

At destination:
- You can dock or land
- You can leave the ship
- You can explore local zones
- You can return to the ship at any time

Location categories:

#### Asteroid belt
- Mine ore nodes
- Find rare minerals
- Risk of collisions / pirate ambush
- Salvage wrecks
- Rock formations and hidden tunnels

#### Space station
- Trade terminals
- Repair bays
- Auction market
- Quest boards
- Crew recruitment
- Smuggling / contraband / dockside tension

#### Planet
- Biomes:
  - forest
  - cave system
  - ocean
  - desert
  - tundra
  - volcanic
- Surface exploration:
  - gather plants / ore / water
  - rescue survivors
  - discover ruins
  - meet aliens
- Planet-specific hazards:
  - storms
  - predators
  - radiation
  - hostile fauna
  - cult/tribe presence

Each planet should have a generated map of explorable zones, not a single static room list.

---

### Milestone 4: Economy and semi-realism
Goal: the trading system should feel like a working economy without becoming spreadsheet-heavy.

Trade categories:
- minerals
- fuel components
- food
- medicine
- rare metals
- tech parts
- alien relics
- contraband
- processed materials

Economic rules:
- Each item has:
  - base value
  - rarity
  - mass
  - demand
  - legality
  - quality
- Stations and planets differ in price
- Prices fluctuate by region and resource abundance
- Trade routes matter
- Sell goods where they are in demand
- Buy where prices are cheapest

Examples:
- refined alloys are valuable on stations, cheap on mining worlds
- medical supplies are high-value on frontier planets
- exotic flora sells on research stations, not on desert outposts

This is the “financial economics” layer you wanted, but without turning the game into a market simulator.

---

### Milestone 5: Crafting and ship customization
Goal: the ship should become your main progression system.

Crafting:
- On-ship crafting menu
- Materials:
  - ore
  - metal
  - carbon fiber
  - algae
  - chemical compounds
- Crafted items:
  - fuel cells
  - repair kits
  - mining drones
  - scanners
  - hull patches
  - field coils
  - shield capacitors

Ship upgrades:
- engine efficiency
- cargo hold
- mining laser
- scanner range
- hull integrity
- shield strength
- crew pod / drone bay
- jump drive (later)
- reactor output

Also allow:
- custom names
- toggles and modules
- module slots
- equipment loadouts

This is a major long-term progression pillar.

---

### Milestone 6: Combat
Goal: add combat in two forms without breaking the text-first style.

#### Ship combat
- enemy ship types:
  - raiders
  - smugglers
  - hunters
  - patrols
  - alien interceptors
- combat stats:
  - hull
  - shields
  - weapons
  - sensors
  - evasion
- command choices:
  - attack
  - flee
  - scan
  - ram
  - disable
  - negotiate
  - boost

#### Ground combat
- hostile fauna
- alien scavengers
- cultists
- robotic sentries
- planetary militia
- wilderness encounters

Combat should use:
- text turn-based battle log
- status effects
- equipment advantages
- terrain and biome modifiers

Keep combat readable and tactical, not a giant statistics screen.

---

### Milestone 7: Aliens and social encounters
Goal: add personality and world texture.

Alien encounters should be:
- not just “random enemies”
- not just “generic green men”

Possible forms:
- trade diplomats
- cult-like nomads
- aquatic peoples on ocean worlds
- deep-cave miners
- biotech researchers
- scavenger clans
- hostile xenophage species

Interaction rules:
- diplomacy
- barter
- escort missions
- intelligence collection
- artifact exchange
- faction reputation

This helps the world feel inhabited.

---

## 3) Recommended Project Structure

Keep the app architecture clean and simple:

- `index.html`: shell + UI panes
- `style.css`: minimal responsive layout
- `script.js`: world state, generation, parser, rendering

### Suggested state model
- player
- ship
- inventory
- currentLocation
- destinationQueue
- galaxy
- currentEncounter
- worldSeed
- time
- reputation
- factionState

### Suggested world data objects
- System
- Destination
- Zone
- Item
- ShipModule
- Enemy
- Faction

A flat state + generated object model is better than deep hardcoded room graphs here.

---

## 4) UI/UX plan

Since this is still text-first:

- Minimal graphics:
  - starfield background
  - simple map panel
  - simple status bars
  - minimal icons only where helpful
- Buttons for mobile:
  - command shortcuts
  - action buttons like “Fly”, “Explore”, “Trade”, “Craft”, “Combat”
- Menus for complexity:
  - inventory
  - crafting
  - upgrade
  - route planner
  - local zone map
- Command parser remains the backbone:
  - fly to
  - explore
  - mine
  - trade
  - craft
  - scan
  - attack
  - use
  - inspect

This preserves the original game’s feel while allowing expansion.

---

## 5) Priority order for implementation

### Phase A: MVP
- command deck
- flight interface
- fuel + travel time
- procedurally generated destinations
- landing/exploration
- asteroid mining
- station trade
- ship inventory
- basic crafting

This is the first playable version.

### Phase B: Expansion
- planet biomes
- ground exploration
- alien encounters
- ship combat
- market fluctuations
- upgrades

### Phase C: Depth
- factions
- quests
- reputation system
- event chains
- multi-system travel
- long-form progression

---

## 6) Risk to avoid

The biggest mistake here would be trying to build everything at once.

Avoid:
- full open-world map with too much complexity too early
- giant item database before travel works
- full combat system before exploration loop is closed
- heavily scripted planets before generation works

The right sequence is:

1. command deck + flight
2. destination generation
3. exploration loop
4. economy
5. crafting
6. combat
7. social/faction depth

---

## 7) Best first implementation target

If you want this to be buildable without getting lost, I’d start with:

- one ship
- one command deck
- one fuel system
- one travel loop
- three destination classes:
  - asteroid belt
  - station
  - planet
- one procedurally generated world object
- one mining/trade loop
- one crafting menu

That gives you a real phase 2 without collapsing into a huge content project.

---

## 8) Recommended next step

The next concrete move is to define a small game spec for the first playable version:

- ship stats
- fuel rules
- destination generator schema
- item list
- planet zone generation
- command menu syntax
- crafting recipes
- combat actions

If you want, I can turn this roadmap into a concrete Phase 2 design doc and then build the first playable slice in `script.js` and `index.html` with:
- command deck
- flight interface
- generated destinations
- travel timer
- mining/trade loop

That would be the actual starting point for the build.