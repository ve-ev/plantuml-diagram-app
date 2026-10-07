# PlantUML diagrams

[![JetBrains Plugin](https://img.shields.io/badge/JetBrains_Marketplace-PlantUML-blue)](https://plugins.jetbrains.com/plugin/34866-plantuml)
[![GitHub release](https://img.shields.io/github/v/release/ve-ev/plantuml-diagram-app?label=release&display_name=release)](https://github.com/ve-ev/plantuml-diagram-app/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An app that shows [PlantUML](https://plantuml.com) diagrams in issue descriptions, comments
and Knowledge Base articles.

The diagram is rendered in the browser with the official PlantUML engine
[`@plantuml/core`](https://www.npmjs.com/package/@plantuml/core) (PlantUML compiled to
JavaScript). No PlantUML server is necessary. The diagram source does not go out of the browser.

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

### Code blocks (optional)

The app can also replace ` ```plantuml ` code blocks with diagrams, as in GitLab.

#### What the app changes

- **Without project attachment**, the app changes nothing. Only users insert diagrams.
- **With project attachment**, a one-line panel below the summary of an issue or the title of an
  article shows the PlantUML code blocks. Only users who can edit the item see it.
- **The app changes an item only after a user turns conversion on for that item** with
  **Convert to diagrams**. Then:
  - The app replaces each ` ```plantuml ` code block in the description or the content with a
    diagram widget. The widget keeps the source of the block, and the block height fits the
    diagram.
  - After each next save, new code blocks also become diagrams.
  - The change is made on behalf of the user who opens the item, in the browser of that user.
    The activity stream shows it as a change of the description.
- **Revert to code** replaces the diagram widgets of the item with code blocks again and turns
  conversion off for the item.
- The app does not change comments, and it does not change code blocks inside other code blocks.

#### Use

1. Attach the app to the project (**Administration → Apps → PlantUML → Projects**).
2. Write the diagram in a code block and save the text:

   ````
   ```plantuml
   Alice -> Bob : request
   ```
   ````

3. In the panel below the summary, select **Convert to diagrams**.
4. To change a diagram, use **Edit** on the diagram. To get the code blocks back, select
   **Revert to code** in the panel.

## Limits

- **Height.** A widget cannot change its own height. The diagram becomes smaller to fit the
  block. The editor shows the height of the diagram. Drag the bottom edge of the block to show
  the diagram at full size.
- **No history.** The diagram source is kept in the widget configuration, not in the text.
  A change of the diagram source does not show in the activity stream.
- **Only in the browser.** Email notifications, PDF export and search do not show the diagram.
- **Code blocks** become diagrams only in projects that the app is attached to, only in items
  where a user turned conversion on, and only in descriptions and articles, not in comments. The
  conversion starts when a user who can edit opens the item after the save.
- **Internal REST fields.** The code block conversion uses REST fields that the public API does
  not document (`markdownEmbeddings`, `admin/widgets/general`). A future version of the host
  can change them. Then the conversion stops with an error in the panel. Diagrams that are
  already in the text continue to work.
- **Simultaneous edits.** If two users save the same text at the same time, the conversion can
  overwrite the change of one user. The conversion reads the text again before it saves, which
  makes this rare.
- **Libraries.** Of the PlantUML standard library, only C4 is available. `!include` of a URL or
  of a file does not work.
- **Icons in the C4 legend** show as empty squares. The default font does not contain these glyphs.
- **Speed.** Each diagram loads the engine (approximately 6 MB, cached by the browser). A page
  with many diagrams loads slowly.

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
| `manifest.json` | App manifest. One `MARKDOWN` widget and the code block panels for issues and articles. |
| `src/widgets/plantuml-app/app.tsx` | View mode and switch to the editor. |
| `src/widgets/plantuml-app/editor.tsx` | Editor dialog (config mode) with live preview. |
| `src/widgets/plantuml-app/diagram.tsx` | Renders one diagram as an `<img>`. Follows the host theme. |
| `src/widgets/plantuml-app/plantuml.ts` | Loads the engine. Runs renders one at a time. |
| `src/widgets/plantuml-app/lines.ts` | Prepares the source and reads errors from the engine output. |
| `src/widgets/plantuml-app/blocks.ts` | Finds and replaces ` ```plantuml ` code blocks. |
| `src/widgets/plantuml-blocks/app.tsx` | One-line panel below the summary: converts code blocks to diagram widgets and back. |
| `src/blocks.js`, `src/entity-extensions.json` | HTTP handler and extension property that store the conversion setting of an item. |
| `vendor/plantuml-stdlib/` | PlantUML standard library bundles (C4). |

The build copies the engine files (`plantuml.js`, `viz-global.js`, `themes.js`) and the
library bundles next to the widget page. They are loaded at run time, not bundled by Vite.

To update the engine, change the exact version of `@plantuml/core` in `package.json`. Then make
sure that `npm test` passes: the error parser depends on the engine output format.

## License

[MIT](LICENSE). The bundled `@plantuml/core` and C4-PlantUML are MIT-licensed too.
