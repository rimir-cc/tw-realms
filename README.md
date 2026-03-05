# realms

> Toggle visibility of tiddler groups (realms) via TiddlyWiki filters

Toggle visibility of tiddler groups from the browser using TiddlyWiki filter expressions. Uses a subtract model -- all tiddlers are visible by default, ticking a realm hides its matching tiddlers.

## Key features

* **Filter-based realms** -- each realm defines a TiddlyWiki filter in `realms.json`
* **Subtract model** -- all visible by default, tick to hide matching tiddlers
* **Per-request filtering** -- server keeps all tiddlers in memory, filtering at the HTTP layer
* **Settings UI** -- toggle realms on/off in ControlPanel with visual feedback
* **No restart needed** -- `realms.json` is re-read per request

## Prerequisites

No external prerequisites.

## Quick start

Define realms in `realms.json` (next to `tiddlywiki.info`):

```json
{ "work": { "filter": "[tag[Work]]", "description": "Work tiddlers", "active": false } }
```

Toggle visibility in ControlPanel > Settings > realms.

## License

MIT -- see [LICENSE.md](LICENSE.md)
