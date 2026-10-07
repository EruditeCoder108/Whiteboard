# Native whiteboard agent integration

The app exposes semantic document operations rather than screen coordinates and button clicks. An
agent can read editable content, create and style objects, move groups and lay out a collection in a
single batch. There is no model/provider charge imposed by this interface. Your chosen external agent
or model may have its own usage costs.

## External agent setup

1. Open the whiteboard, then **sparkle button → External agents → Enable connection**.
2. Choose **Copy MCP configuration** and add it to your MCP client's server configuration. Node.js
   22 or newer must be available as `node` on that client's machine.
3. Connect the MCP client. Ask it to read the board and perform an edit. Keep the whiteboard open.

The app copies its dependency-free adapter to the data directory, so the saved MCP paths survive
portable extraction directories changing. The connection file is read for each call; restarting and
enabling the board creates a fresh token/port without needing a new client configuration, provided the
data directory stays the same. This release implements stdio MCP revision `2025-11-25`, initialization,
ping, tool discovery and tool calls. It does not configure a particular agent client for you.

Example configuration shape (use the actual copied absolute paths):

```json
{
  "mcpServers": {
    "floating-whiteboard": {
      "command": "node",
      "args": ["<data-directory>/whiteboard-mcp.cjs", "<data-directory>/agent-connection.json"]
    }
  }
}
```

Access is off on startup. The connection listens on IPv4 loopback only and requires a random token.
Browser Origin headers and alternate Host headers are rejected. The token is in a local connection
file for the adapter, not copied configuration, command arguments, board files or the renderer. Local
software running as the same user can read that file; enabling grants that local software board access.
Disable the connection to close its port and remove the file. There is no remote hosting, sign-in or
automatic model call.

## Tools

`whiteboard_replay` provides `status`, `start`, `pause_recording`, `resume_recording`, `stop`, `play`,
`pause`, `seek` and `close`. Start with a lesson title before issuing normal `whiteboard_apply` batches;
their labels become recording steps. `selectedOnly: true` includes selected existing objects and new
objects while excluding unrelated existing content. Stop saves the lesson locally. Status lists compact
IDs, titles, durations and step counts without sending stroke samples to the model. Play accepts an ID
and optional speed (0.25, 0.5, 1, 1.5, 2 or 4). Seek uses milliseconds. Playback previews on a separate
canvas; close it before applying further edits. `whiteboard_read.playbackActive` indicates preview mode;
reads continue to describe the working board. Reusable file and video export are in the clapperboard
panel. The optional built-in assistant continues to propose read/apply drafts; replay controls are for
external MCP agents and the user interface.

`whiteboard_read` returns revision, view, viewport, selection IDs and compact object summaries. It
supports ID filters, text search and offset/limit pagination (maximum 200). Ink is represented by
bounds and point count, so agents do not spend tokens on stroke samples. Text defaults to 2,000
characters per object. To read complete long text, request one ID with `limit: 1, textLimit: 100000`.
An aggregate text budget limits response growth. `textTruncated` and `nextOffset` expose truncation.

`whiteboard_apply` requires the revision from a read, a unique requestId, a short label and 1–200
operations. It supports:

| Operation | Behavior |
|---|---|
| create | Notes, text, rectangles, ellipses, diamonds, triangles, lines and arrows. Caller supplies stable unique IDs. |
| update | Text, appearance, rotation in radians and rectangular geometry. Text reflows/grows through the normal editor rules. |
| move | Moves objects by world-space dx/dy; entire groups move together. |
| arrange | Row, column or grid with spacing; each group is a unit. Ordering follows the requested IDs. |
| group / ungroup | Expands existing groups and preserves object IDs. |
| remove | Removes whole groups as one undo transaction. |

Styles include color, strokeWidth, fill, opacity, fontSize, textColor, bold, italic, align, list,
dash and radius where the object supports them. Lines/arrows use free endpoints expressed as x/y plus
width/height, which may be negative; attached connectors arrive in the diagram phase. Ink can be read,
styled, moved, grouped, arranged or removed; agent ink creation/resizing is not part of this release.

Coordinates are world coordinates. A viewport's world width is `viewport.w / view.zoom`. Use explicit
positions to avoid replacing or obscuring unrelated content. Locked objects cannot be edited or
unlocked by an agent; unlock manually when intended. Active manual gestures/text edits return BUSY.

All operations validate before any live mutation. An invalid later operation rejects the whole batch.
`dryRun: true` returns changed/removed IDs and proposed summaries without modifying the board.
Successful batches use the normal document history, autosave and native format; Ctrl+Z undoes the batch.
Revision conflicts require reading again. Repeating the same requestId and batch returns the original
result without a second edit; different content with that requestId is rejected. The retry cache holds
the last 100 successful transactions in the current process, and undo does not replay a retried batch.

```json
{
  "expectedRevision": 12,
  "requestId": "unique-task-id",
  "label": "Create a study plan",
  "operations": [
    { "op": "create", "id": "study-a", "kind": "note", "x": 100, "y": 100,
      "text": "Learn the concept", "fill": "#fff1a8" },
    { "op": "create", "id": "study-b", "kind": "note", "x": 400, "y": 100,
      "text": "Practice examples", "fill": "#dbeafe" },
    { "op": "arrange", "ids": ["study-a", "study-b"], "layout": "row", "gap": 32 }
  ]
}
```

Use the current revision, not the illustrative value 12. The protocol does not expose arbitrary JavaScript,
shell commands, filesystem access, provider credentials or automatic file export.

## Optional assistant without an OpenAI key

Run an existing local model server, such as Ollama, with an installed model that supports function
tools. In **Connection settings**, use its base URL (default `http://127.0.0.1:11434/v1`), leave the key
empty, choose **Find models**, and select an installed model. Choose Chat Completions for ordinary
compatible servers, or Responses when your chosen endpoint/model requires it. A model is not bundled
and this release does not automatically install or download one.

Enter a prompt and choose **Prepare draft**. The assistant gets a compact initial snapshot (up to 40
objects, text clipped to 500 characters per object), can read additional context, and uses the same
apply command in dry-run mode. A valid proposal shows a thumbnail, affected/removal counts and an Apply
button. Applying produces one normal undo step. If the document changed, regenerate the draft. Stop
cancels the request; model output never applies on its own. Up to four requests and 4,096 output tokens
per model response bound the loop. Provider usage depends on the chosen model and compatibility.

Each prompt starts fresh; this is a board editing assistant, not a persistent chat or background agent.
The selected objects guide its initial context when a selection exists. Board text is passed as
untrusted data, and the model has no tool authority beyond reading and proposing board edits.

For an optional remote provider, configure an HTTPS base URL, model and key. Prompt and board text
are sent to that configured endpoint when you choose Prepare draft. Keys are encrypted in the main
process using Electron safeStorage, never loaded into renderer configuration, and cleared on an exact
endpoint change. Model discovery contacts the configured endpoint only when requested. Redirects are
rejected and responses are bounded. Live provider generation is not verified without credentials;
desktop tests use a local protocol fixture, including Responses, cancellation and encrypted-key storage.

## Technical references

- [MCP stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [WebMCP origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial) — browser integration remains experimental and is not a dependency of the desktop adapter.
- [Ollama compatible endpoints and tools](https://docs.ollama.com/api/openai-compatibility)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
