# PlantUML stdlib bundles

`scripts/build-engine.mjs` puts every `*.min.js` file of this folder into `dist/plantuml-engine.js`,
in front of the engine, so `!include <lib/...>` works on the server without loading files.

| File | Library | Source |
|---|---|---|
| `c4.min.js` | C4-PlantUML 2.14.0 (MIT) | https://plantuml.github.io/plantuml/js-plantuml/c4.min.js |

To add a library, download its bundle from the same location.
