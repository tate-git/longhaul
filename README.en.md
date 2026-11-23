# 🌙 Long Haul

[한국어](README.md) · **English**

A long-distance driving game: take a 3D truck down the highway, leaving in the afternoon, passing through sunset and arriving at night.

▶ **Play: not deployed yet** — see "Run locally" below.

## About

- Drive Seoul → Daejeon, 70 km (7 km in the game, with time running 10× slower), in a chase camera view.
- Pass a toll gate, tunnels, a rest area and a windy bridge on the way to the logistics center.
- Works on phone and PC.

## Rules

- Speed limit 90 km/h; 30 km/h through the toll lane.
- You can take a 15-minute break at the rest area.
- Stop inside the green bay at the logistics center to finish → driving log and ⭐ rating.

## Run locally

```sh
npx wrangler dev --port 8797
```

## Code map

| Path | What's there |
|---|---|
| `public/js/route.js` | The road (curves, slopes, rest stops, terrain height) |
| `public/js/truck.js` | Truck physics (lane-keeping assist) |
| `public/js/world.js` · `sky.js` · `traffic.js` | Scenery · sky over time · other vehicles |
| `public/js/app.js` | Game flow and UI |

Built with three.js; everything is made in code, no model files.
