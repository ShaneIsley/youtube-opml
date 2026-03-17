# YouTube to OPML

A browser bookmarklet that exports your YouTube subscriptions and playlists as an OPML file for import into any RSS reader.

## What it does

When activated on YouTube, the bookmarklet scans the sidebar for your subscriptions and playlists, builds RSS feed URLs for each, and presents a modal where you can search, filter, and select which feeds to include. It then downloads an OPML file ready for import into readers like Feedly, Inoreader, Miniflux, or Newsboat.

## Setup

1. Create a new bookmark in your browser.
2. Set the **Name** to something like `YouTube → OPML`.
3. Set the **URL** to the contents of [`youtube-opml-bookmarklet-mini.js`](https://raw.githubusercontent.com/ShaneIsley/youtube-opml/refs/heads/main/youtube-opml-bookmarklet-mini.js), prefixed with `javascript:`.
4. Save the bookmark.

## Usage

1. Go to [youtube.com](https://www.youtube.com) and make sure you are logged in.
2. Click the bookmarklet.
3. Wait a moment — the script will open the sidebar if needed and expand any collapsed sections.
4. A dark modal will appear listing all discovered feeds with a count in the header.
5. Use the search box to filter, and the **Select All** / **Select None** buttons to bulk-toggle.
6. Click **Download OPML** to save the file.
7. Import the downloaded `youtube_feeds.opml` into your RSS reader of choice.

## Feed types

The bookmarklet discovers two kinds of feeds:

- **Subscriptions** — channels you're subscribed to (identified by `UC`-prefixed channel IDs).
- **Playlists** — playlists in your sidebar, including Liked Videos (identified by `VL`-prefixed browse IDs or `watchEndpoint` playlist IDs).

All feed URLs point to YouTube's public Atom feeds at `youtube.com/feeds/videos.xml`.

## Files

- [`youtube-opml-bookmarklet-mini.js`](https://raw.githubusercontent.com/ShaneIsley/youtube-opml/refs/heads/main/youtube-opml-bookmarklet-mini.js) — minified bookmarklet, ready to paste into a bookmark URL.
- `youtube-to-opml.js` — commented, readable version of the same script for review or modification.

## Requirements

- A modern browser (Chrome, Firefox, Edge, Safari).
- You must be logged in to YouTube so that subscriptions appear in the sidebar.

## Limitations

- The script relies on YouTube's internal Polymer/Lit component data (`__data`). If YouTube significantly changes its frontend framework, the bookmarklet may need updating.
- Only feeds visible in the sidebar are discovered. If YouTube truncates the sidebar beyond a certain number of subscriptions, some may be missed.
- YouTube's public RSS feeds may not include every video type (e.g. Shorts, community posts).

## License

MIT
