# PlantUML for YouTrack

A YouTrack app that shows [PlantUML](https://plantuml.com) diagrams in issue descriptions,
comments and Knowledge Base articles. It is an answer to
[JT-57907 "Plantuml diagram support"](https://youtrack.jetbrains.com/issue/JT-57907).

The diagram is rendered in the browser with the official PlantUML engine
[`@plantuml/core`](https://www.npmjs.com/package/@plantuml/core) (PlantUML compiled to
JavaScript). No PlantUML server is necessary. The diagram source does not go out of the browser.

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
System_Boundary(yt, "YouTrack") {
  Container(widget, "PlantUML widget", "React", "Renders diagrams")
}
Rel(user, widget, "Edits diagram")
```

## Limits

- **Height.** A widget cannot change its own height. The diagram becomes smaller to fit the
  block. The editor shows the height of the diagram. Drag the bottom edge of the block to show
  the diagram at full size.
- **No history.** YouTrack keeps the diagram source in the widget configuration, not in the text.
  A change of the diagram source does not show in the activity stream.
- **Only in the browser.** Email notifications, PDF export and search do not show the diagram.
- **Code blocks.** A ` ```plantuml ` code block does not become a diagram. Use the widget.
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

Upload to a YouTrack instance:

```bash
export YOUTRACK_HOST=https://youtrack.example.com
export YOUTRACK_API_TOKEN=perm-...
npm run upload
```

Or run `npm run pack` and import `plantuml-diagrams.zip` on the **Administration → Apps** page.

### Structure

| Path | Content |
|---|---|
| `manifest.json` | App manifest. One `MARKDOWN` widget. |
| `src/widgets/plantuml-app/app.tsx` | View mode and switch to the editor. |
| `src/widgets/plantuml-app/editor.tsx` | Editor dialog (config mode) with live preview. |
| `src/widgets/plantuml-app/diagram.tsx` | Renders one diagram as an `<img>`. Follows the YouTrack theme. |
| `src/widgets/plantuml-app/plantuml.ts` | Loads the engine. Runs renders one at a time. |
| `src/widgets/plantuml-app/lines.ts` | Prepares the source and reads errors from the engine output. |
| `vendor/plantuml-stdlib/` | PlantUML standard library bundles (C4). |

The build copies the engine files (`plantuml.js`, `viz-global.js`, `themes.js`) and the
library bundles next to the widget page. They are loaded at run time, not bundled by Vite.

To update the engine, change the exact version of `@plantuml/core` in `package.json`. Then make
sure that `npm test` passes: the error parser depends on the engine output format.

## License

The app code has no license yet. `@plantuml/core` and C4-PlantUML are MIT-licensed.
