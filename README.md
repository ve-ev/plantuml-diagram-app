# PlantUML diagrams

An app that shows [PlantUML](https://plantuml.com) diagrams in issue descriptions, comments
and Knowledge Base articles.

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
System_Boundary(tracker, "Issue tracker") {
  Container(widget, "PlantUML widget", "React", "Renders diagrams")
}
Rel(user, widget, "Edits diagram")
```

### Code blocks (optional)

The app can also replace ` ```plantuml ` code blocks with diagrams, as in GitLab.

#### What the app changes

- **Without project attachment**, the app changes nothing. Only users insert diagrams.
- **When the app is attached to a project**, the app edits the issues and articles of that
  project:
  - The app replaces each ` ```plantuml ` code block in the description of an issue or in the
    content of an article with a diagram widget. The widget keeps the source of the block.
  - The app makes this change when a user who can edit the item opens it. The change is made on
    behalf of that user. The activity stream shows it as a change of the description, and
    watchers can get a notification.
  - The app also changes **old** items. An issue that contains a ` ```plantuml ` block from the
    past changes when a user who can edit it opens it next time.
  - The app also replaces a ` ```plantuml ` block that is an example of code and not a diagram.
    To keep such a block as code, use a different language name, for example ` ```text `, or
    put the block inside another code block.
  - The app does not change comments.
- **To stop the changes**, detach the app from the project. Diagrams that are already in the
  text continue to work.

Before you attach the app to a project, make sure that the project has no ` ```plantuml `
blocks that must stay as code.

#### Use

1. Attach the app to the project (**Administration → Apps → PlantUML → Projects**).
2. Write the diagram in a code block:

   ````
   ```plantuml
   Alice -> Bob : request
   ```
   ````

3. Save the text. After a few seconds, the code block becomes a diagram widget. The block height
   fits the diagram.
4. To change the diagram, use **Edit** on the diagram.

A panel below the summary shows the result. Only users who can edit the issue or article see it.
The conversion runs in the browser of the user who opens the item.

## Limits

- **Height.** A widget cannot change its own height. The diagram becomes smaller to fit the
  block. The editor shows the height of the diagram. Drag the bottom edge of the block to show
  the diagram at full size.
- **No history.** The diagram source is kept in the widget configuration, not in the text.
  A change of the diagram source does not show in the activity stream.
- **Only in the browser.** Email notifications, PDF export and search do not show the diagram.
- **Code blocks** become diagrams only in projects that the app is attached to, and only in
  descriptions and articles, not in comments. The conversion starts when a user who can edit
  opens the item after the save.
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

Or run `npm run pack` and import `plantuml-diagrams.zip` on the **Administration → Apps** page.

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
| `src/widgets/plantuml-blocks/app.tsx` | Panel below the summary: replaces code blocks with diagram widgets. |
| `vendor/plantuml-stdlib/` | PlantUML standard library bundles (C4). |

The build copies the engine files (`plantuml.js`, `viz-global.js`, `themes.js`) and the
library bundles next to the widget page. They are loaded at run time, not bundled by Vite.

To update the engine, change the exact version of `@plantuml/core` in `package.json`. Then make
sure that `npm test` passes: the error parser depends on the engine output format.

## License

The app code has no license yet. `@plantuml/core` and C4-PlantUML are MIT-licensed.
