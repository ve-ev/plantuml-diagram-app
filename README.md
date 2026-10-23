# PlantUML diagrams

[![JetBrains Plugin](https://img.shields.io/badge/JetBrains_Marketplace-PlantUML-blue)](https://plugins.jetbrains.com/plugin/34866-plantuml)
[![GitHub release](https://img.shields.io/github/v/release/ve-ev/plantuml-diagram-app?label=release&display_name=release)](https://github.com/ve-ev/plantuml-diagram-app/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An app that shows [PlantUML](https://plantuml.com) diagrams in issue descriptions, comments
and Knowledge Base articles.

The diagram is rendered in the browser with the official PlantUML engine
[`@plantuml/core`](https://www.npmjs.com/package/@plantuml/core) (PlantUML compiled to
JavaScript), when you save it. The app stores the rendered SVG with the diagram, so readers do not
load the engine. No PlantUML server is necessary. The diagram source does not go out of the browser.

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
- **With project attachment**, the options menu of an issue or article has the item
  **PlantUML code blocks**. Only users who can edit the item see it.
- **The app changes the text only when a user selects an action** in this item:
  - **Convert to diagrams** replaces each ` ```plantuml ` code block in the description or the
    content with a diagram widget. The widget keeps the source and the rendered diagram, and the
    block height fits the diagram. A code block with several `@start…` / `@end…` diagrams becomes
    one widget for each diagram.
  - **Revert to code** replaces each diagram widget with a code block again.
  - The change is made on behalf of the user who selects the action. The activity stream shows
    it as a change of the description.
- The app does not change comments, and it does not change code blocks inside other code blocks.

#### Use

1. Attach the app to the project (**Administration → Apps → PlantUML → Projects**).
2. Write the diagram in a code block and save the text:

   ````
   ```plantuml
   Alice -> Bob : request
   ```
   ````

3. In the options menu of the issue or article, select **PlantUML code blocks → Convert to
   diagrams**.
4. To change a diagram, use **Edit** on the diagram. To get the code blocks back, select
   **PlantUML code blocks → Revert to code**.

## Limits

- **Height.** A widget cannot change its own height. The diagram becomes smaller to fit the
  block. The editor shows the height of the diagram. Drag the bottom edge of the block to show
  the diagram at full size.
- **No history.** The diagram source is kept in the widget configuration, not in the text.
  A change of the diagram source does not show in the activity stream.
- **Only in the browser.** Email notifications, PDF export and search do not show the diagram.
- **Code blocks** become diagrams only in projects that the app is attached to, only when a user
  selects **Convert to diagrams**, and only in descriptions and articles, not in comments. New
  code blocks stay code until a user converts them.
- **Internal REST fields.** The code block conversion uses REST fields that the public API does
  not document (`markdownEmbeddings`, `admin/widgets/general`). A future version of the host
  can change them. Then the conversion stops with an error. Diagrams that are already in the text
  continue to work.
- **Engine download.** The editor loads the engine (approximately 6 MB, cached by the browser)
  the first time it renders. Readers do not load it.
- **Diagrams of version 1.0.** They have no stored SVG. They load the engine and render each time
  they are shown, until the next edit.
- **Icons in the C4 legend** show as empty squares. The default font does not contain these glyphs.
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
| `manifest.json` | App manifest. One `MARKDOWN` widget and the code block menu items for issues and articles. |
| `src/widgets/plantuml-app/app.tsx` | View mode: shows the stored SVG of the current theme. |
| `src/widgets/plantuml-app/editor.tsx` | Editor dialog (config mode) with live preview. Loaded only for editing. |
| `src/widgets/plantuml-app/diagram.tsx` | Shows one rendered diagram as an `<img>`. |
| `src/widgets/plantuml-app/plantuml.ts` | Loads the engine on the first render. Runs renders one at a time and keeps each result. |
| `src/widgets/plantuml-app/lines.ts` | Prepares the source, gives the cache key and reads errors from the engine output. |
| `src/widgets/plantuml-app/blocks.ts` | Finds and replaces ` ```plantuml ` code blocks. |
| `src/widgets/plantuml-blocks/app.tsx` | Options menu item: converts code blocks to diagram widgets and back. |
| `vendor/plantuml-stdlib/` | PlantUML standard library bundles (C4). |

The build copies the engine files (`plantuml.js`, `viz-global.js`, `themes.js`) and the
library bundles next to the widget page. They are loaded at run time, not bundled by Vite.

To update the engine, change the exact version of `@plantuml/core` in `package.json`. Then make
sure that `npm test` passes: the error parser depends on the engine output format.

## License

[MIT](LICENSE). The bundled `@plantuml/core` and C4-PlantUML are MIT-licensed too.
