# LumaFind

LumaFind is a visual image-search app designed to help users discover images and visual inspiration by searching for a topic.

**Part 1** built the responsive search interface and an empty results grid.
**Part 2** (this version) connects it to the Wikimedia Commons API (no API key needed): type a topic and press Search (or Enter) and real image cards appear in the grid.

## How it works

1. The form's `submit` event is caught and `event.preventDefault()` stops the page reload.
2. The query is read from the input, trimmed, and ignored if blank.
3. A request URL is built with `encodeURIComponent(query)`, fetched with `await fetch(url)`, and `response.ok` is checked before the JSON is parsed.
4. Old results are cleared, then one card per image is built with `document.createElement` and added with `appendChild`.

## My enhancements

- **Quick-pick chips are live:** clicking Nature, Architecture, Anime or Space runs a search.
- **Result count:** "Showing 24 results for “…”".
- **Each card links to the full-size image** (opens in a new tab).
- **Extra data per card:** author/artist and image dimensions.
- A friendly "no results" message when a search finds nothing.

## Design

A dark navy, teal and amber palette gives the app its own identity, and the quick-pick row shows users example topics without making the page feel like a traditional search engine.

Coming in Part 3: loading spinners and full error handling.
