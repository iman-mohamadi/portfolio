/** Waypoints for the auto tour. `dwell` = seconds to stop and let the info panel be read. Routes avoid every collider. */
export const buildTourRoute = (projZones) => [

  { p: [0, 4], dwell: 11 },
  { p: [-14, 4] }, { p: [-28, -6], dwell: 8 },
  { p: [-14, 8] }, { p: [0, 10] }, { p: [14, 8] }, { p: [27, -4], dwell: 8 },
  { p: [12, -12] }, { p: [0, -24] },
  ...projZones.map((z) => ({ p: z.pos, dwell: 4.6 })),
  { p: [48, -40] }, { p: [50, 10] }, { p: [-36, 20] },
  { p: [-36, 36], dwell: 6.5 }, { p: [-18, 40] }, { p: [-18, 26] }, { p: [0, 24] }, { p: [0, 36], dwell: 6.5 },
  { p: [18, 40] }, { p: [18, 26] }, { p: [36, 24] }, { p: [36, 36], dwell: 6.5 },
  { p: [24, 50] }, { p: [0, 55], dwell: 10 },
]
