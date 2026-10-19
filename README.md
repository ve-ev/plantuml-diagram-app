# PlantUML diagrams

[![JetBrains Plugin](https://img.shields.io/badge/JetBrains_Marketplace-PlantUML-blue)](https://plugins.jetbrains.com/plugin/34866-plantuml)
[![GitHub release](https://img.shields.io/github/v/release/ve-ev/plantuml-diagram-app?label=release&display_name=release)](https://github.com/ve-ev/plantuml-diagram-app/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An app that shows [PlantUML](https://plantuml.com) diagrams in issue descriptions, comments
and Knowledge Base articles.

The diagram is rendered on your YouTrack server with the official PlantUML engine
[`@plantuml/core`](https://www.npmjs.com/package/@plantuml/core) (PlantUML compiled to
JavaScript), when you save it. Readers do not load a diagram engine: the app stores the rendered
SVG with the diagram. No PlantUML server is necessary, and the diagram source does not go to
other servers.

![Diagrams rendered by the app: a C4 container diagram, a sequence diagram and a mind map](screenshots/preview.png)

## Use

1. In the editor toolbar, select **Images and embedded content → PlantUML**.
2. Type the diagram source. The preview shows the diagram while you type.
3. Click **Save**.
4. To change the diagram, put the pointer on it and click **Edit**.

`@startuml` and `@enduml` are optional, as in GitLab. Other diagram types must start with their
own keyword, for example `@startmindmap` or `@startgantt`.

Example:

```
Alice -> Bob : request
Bob --> Alice : response
```

### C4 diagrams

The app contains the C4-PlantUML library:

```
!include <C4/C4_Container>

Person(user, "Engineer")
System_Boundary(tracker, "Issue tracker") {
  Container(widget, "PlantUML widget", "React", "Renders diagrams")
}
Rel(user, widget, "Edits diagram")
```

## Limits

- **Height.** A widget cannot change its own height. The diagram becomes smaller to fit the
  block. The editor shows the height of the diagram. Drag the bottom edge of the block to show
  the diagram at full size.
- **No history.** The diagram source is kept in the widget configuration, not in the text.
  A change of the diagram source does not show in the activity stream.
- **Only in the browser.** Email notifications, PDF export and search do not show the diagram.
- **No Graphviz.** The YouTrack script runtime cannot run Graphviz, so the engine lays out class,
  component, state, use case and C4 diagrams with Smetana, the Java port of Graphviz in PlantUML.
  The layout can differ from the layout of the PlantUML server.
- **Text width.** The server has no fonts. The engine measures text with fixed Helvetica letter
  widths, so text in other fonts can fit its box less exactly.
- **Speed.** A render takes a fraction of a second, but `!include <C4/...>` adds several seconds
  to each render, and much more if the YouTrack JVM runs scripts without a JIT compiler. Saving a
  C4 diagram renders it twice, in the light and the dark theme.
- **Diagrams of version 1.0.** They have no stored SVG. The server renders them each time they
  are shown, until the next edit.
- **Libraries.** Of the PlantUML standard library, only C4 is available. `!include` of a URL or
  of a file does not work.

## Development

Requirements: Node.js 20.18 or later.

```bash
npm install
npm run build    # type check, build to dist/, validate the manifest
npm test         # unit tests (Node.js test runner)
npm run lint
```

Upload to an instance:

```bash
export YOUTRACK_HOST=https://tracker.example.com
export YOUTRACK_API_TOKEN=perm-...
npm run upload
```

Or run `npm run pack` and import `app.zip` on the **Administration → Apps** page.

### Release

GitHub Actions makes releases. Both workflows run only by hand (**Actions → workflow → Run workflow**).

- **Release** (`.github/workflows/release.yml`): checks that `package.json` and `manifest.json`
  have the given version, runs lint, tests and the build, adds the tag `release-<version>` to the
  current commit of `main`, and attaches `app-<version>.zip` to a GitHub release. Change the
  version and `changeNotes` in a pull request before the release.

  ```bash
  gh workflow run release.yml -f version=1.0.1 -f notes="- What changed."
  ```

- **Publish to Marketplace** (`.github/workflows/publish-marketplace.yml`): uploads the zip of an
  existing release to JetBrains Marketplace. Each version waits for moderation.

  ```bash
  gh workflow run publish-marketplace.yml -f version=1.0.1
  ```

  The workflow uploads to the listing [34866](https://plugins.jetbrains.com/plugin/34866-plantuml).
  It needs a [Marketplace token](https://plugins.jetbrains.com/author/me/tokens) in the repository
  secret `MARKETPLACE_TOKEN`.

Update `changeNotes` in `manifest.json` before each release: Marketplace shows it.

### Structure

| Path | Content |
|---|---|
| `manifest.json` | App manifest. One `MARKDOWN` widget. |
| `src/render.js` | HTTP handler `render/svg`: renders the source to SVG on the server, in one theme. |
| `src/lines.js` | Prepares the source and reads errors from the engine output. |
| `server/shim.js` | Minimal DOM, timers and text measure, so that the engine runs in the YouTrack script runtime. |
| `scripts/build-engine.mjs` | Builds `dist/plantuml-engine.js`: the shim, themes, the C4 bundle and the engine as one CommonJS module. |
| `src/widgets/plantuml-app/app.tsx` | View mode: shows the stored SVG of the current theme. |
| `src/widgets/plantuml-app/editor.tsx` | Editor dialog (config mode) with a live preview from the server. Loaded only for editing. |
| `src/widgets/plantuml-app/plantuml.ts` | Client of the render endpoint. |
| `vendor/plantuml-stdlib/` | PlantUML standard library bundles (C4). |

To update the engine, change the exact version of `@plantuml/core` in `package.json`. Then make
sure that `npm test` passes and that `npm run build` finds the engine export: the build script
and the error parser depend on the engine output format.

## License

[MIT](LICENSE). The bundled `@plantuml/core` and C4-PlantUML are MIT-licensed too.
