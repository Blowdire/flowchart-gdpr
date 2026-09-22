# flowchart-viz

Renders the tagged GDPR decision graph (`src/flowchart.json`, a copy of the
repo-root `subtree.json` produced by `generate_subtree_json.py`) as a proper
flowchart using React Flow + dagre auto-layout.

- Nodes are laid out top-to-bottom, coloured by `reverse_engineering_type`
  (legend shown top-left).
- Edges keep their Visio labels (yes / no / and / or / ...).

## Run

This repo lives on a FAT filesystem, so install without symlinked bins:

```
npm install --no-bin-links
node node_modules/vite/bin/vite.js dev      # or: build / preview
```

To refresh the data: regenerate `subtree.json` at the repo root, then
`cp ../subtree.json src/flowchart.json`.
