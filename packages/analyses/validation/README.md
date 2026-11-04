# Wind solver validation (AIJ benchmarks)

`aij.ts` builds the AIJ Case A (single 2:1:1 block) and Case B (block within a low-rise array) geometries, runs the
Saturn lattice-Boltzmann solver, and scores it against measured pedestrian-level speed ratios when the data files
`data/A.json` and `data/B.json` exist (format: `[{ "x": m, "y": m, "ratio": number }]`, block centred at the origin,
wind from −x). The measured datasets are published by the Architectural Institute of Japan and must be obtained from
their site (they are not redistributed here).

Run:

```bash
pnpm --filter @saturn/analyses validate:aij
```

Without data the harness prints the simulated ratios on the standard sampling lines so the qualitative pattern
can be checked (slow-down upstream, acceleration past the corners, recirculating wake). Record results in
`docs/06-analysis-methods.md` once the datasets are in place.
