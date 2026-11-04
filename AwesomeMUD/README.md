# Deep Drift

A simple browser-based single-player space exploration MUD prototype built with plain HTML, CSS, and JavaScript.

## How to run

Open `index.html` directly in a browser, or serve the folder locally:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in the browser.

## Commands

- Phase 1: `look`, `inventory`, `take <item>`, `drop <item>`, `salvage`, `use <item>`, `go <direction>`, `examine <subject>`
- Phase 2: `flight`, `travel to <destination>`, `board`, `land`, `explore`, `mine`, `trade`, `craft <recipe>`, `upgrade <system>`, `scan`, `cargo`, `minerals`, `ship`, `modules`, `inspect <module>`
- General: `help`, `progress`, `save`, `load`, `reset`, `map`

## Phase 1 Goal

Collect the flux core from the reactor core and use it at the command deck to repair the ship. Search the maintenance corridor for spare parts to salvage minerals for your ship reserves.

## Phase 2 Exploration

The command deck generates a seeded route network for each new game. Asteroid destinations contain a finite set of survey locations: exploration reveals ore seams or one-time salvage, and mining consumes the discovered ore. Planet biomes yield harvestable samples that can be analyzed in the ship lab or sold at trade stations. Save/load preserves the current galaxy and site progress; reset generates a new galaxy.

Oxygen automatically restores one action every twenty seconds up to the reserve capacity, including after depletion. At a landed station or planet, `trade buy oxygen` remains available for an immediate refill: 8 credits restores up to 6 actions.

Installed modules and upgrades affect ship capabilities:
- Use `modules` or `inspect <module>` to inspect module operational statuses.
- Use `craft` to assemble modules: `fuel_cell`, `alloy_patch`, `mining_laser`, `deep_scanner`, `shield_capacitor`.
- Use `upgrade` to tune systems: `engine` (fuel efficiency), `mining` (mineral harvest yield), `shield` (deflector capacity), and `cargo` (hold size).
- Use `scan` in orbit to run orbital sweeps, or on the surface to survey terrain.
