/**
 * YouTube to OPML Bookmarklet
 *
 * Extracts RSS feed URLs for all YouTube subscriptions and playlists
 * visible in the sidebar, then lets you export them as an OPML file
 * for import into any RSS reader (Feedly, Inoreader, Miniflux, etc.).
 *
 * Usage: Create a browser bookmark with the URL set to:
 *   javascript:(function(){ ... })();
 * Then click it while on any YouTube page while logged in.
 */
(function () {
  // Prevent multiple instances — if the modal is already open, bail out.
  if (document.getElementById("yre-bg")) return;

  let attempts = 0;

  // ─────────────────────────────────────────────
  // Phase 1: Ensure the sidebar is open and fully expanded
  // ─────────────────────────────────────────────

  function checkSidebar() {
    const nodes = document.querySelectorAll("ytd-guide-entry-renderer");

    // If no sidebar entries exist yet, the sidebar panel is probably closed.
    // Try clicking the hamburger menu button to open it, then retry.
    if (nodes.length === 0) {
      const btn =
        document.querySelector("#guide-button button") ||
        document.querySelector("#guide-button");
      if (btn) btn.click();

      // Retry up to 10 times at 300ms intervals, giving the sidebar time to render.
      if (attempts++ < 10) {
        setTimeout(checkSidebar, 300);
        return;
      }
    }

    // Expand any collapsed "Show more" sections so all subscriptions are visible.
    const expanders = document.querySelectorAll(
      "ytd-guide-collapsible-entry-renderer:not([expanded]) #expander-item"
    );
    if (expanders.length > 0) {
      expanders.forEach((e) => e.click());
    }

    // Reset counter — it will be reused by the extraction polling loop.
    attempts = 0;

    // Track how many items we found on consecutive polls.
    // We wait until the count stabilises before proceeding.
    let prevCount = -1;
    let stableCount = 0;

    // ─────────────────────────────────────────────
    // Phase 2: Extract feed data from sidebar entries
    // ─────────────────────────────────────────────

    function extract() {
      const items = [];
      const seen = new Set();

      document.querySelectorAll("ytd-guide-entry-renderer").forEach((el) => {
        try {
          // YouTube uses Polymer/Lit web components whose internal state
          // is accessible via __data (or sometimes .data).
          const data = el.__data || el.data;
          if (!data) return;

          // Get the display title — prefer the structured data, fall back to DOM text.
          let title = data.formattedTitle
            ? data.formattedTitle.simpleText
            : el.querySelector(".title")
              ? el.querySelector(".title").textContent.trim()
              : "";

          // The navigation endpoint tells us where clicking this entry would go.
          const endpoint = data.navigationEndpoint || data.command;
          if (!endpoint) return;

          let url = "";
          let type = "";

          if (endpoint.browseEndpoint) {
            const id = endpoint.browseEndpoint.browseId;

            if (id && id.startsWith("UC")) {
              // Channel IDs start with "UC" — this is a subscription.
              type = "Subscription";
              url =
                "https://www.youtube.com/feeds/videos.xml?channel_id=" + id;
            } else if (id && id.startsWith("VL")) {
              // Playlist browse IDs are prefixed with "VL"; strip it for the feed URL.
              type = "Playlist";
              url =
                "https://www.youtube.com/feeds/videos.xml?playlist_id=" +
                id.replace(/^VL/, "");
            }
          } else if (endpoint.watchEndpoint) {
            const id = endpoint.watchEndpoint.playlistId;

            if (id) {
              type = "Playlist";
              // "LL" is YouTube's internal ID for the Liked Videos playlist.
              if (id === "LL") title = "Liked Videos";
              url =
                "https://www.youtube.com/feeds/videos.xml?playlist_id=" + id;
            }
          }

          // Deduplicate by feed URL.
          if (url && !seen.has(url)) {
            seen.add(url);
            items.push({
              title: title || "Unknown",
              url: url,
              type: type,
            });
          }
        } catch (err) {
          // Silently skip entries that don't match the expected structure.
        }
      });

      // ── Stability polling ──
      // YouTube may still be lazily rendering sidebar entries. We poll until
      // the discovered item count stays the same for two consecutive checks,
      // or we exceed 15 attempts (~3.75s).
      const currentNodes = document.querySelectorAll(
        "ytd-guide-entry-renderer"
      );

      if (currentNodes.length > 0 && attempts < 15) {
        attempts++;

        if (items.length !== prevCount) {
          // Count changed — reset the stability counter and keep waiting.
          prevCount = items.length;
          stableCount = 0;
          setTimeout(extract, 250);
          return;
        }

        stableCount++;

        if (stableCount < 2) {
          // Count matched once — wait one more cycle to be sure.
          setTimeout(extract, 250);
          return;
        }
      }

      // If we still found nothing, something went wrong.
      if (items.length === 0) {
        alert(
          "No feeds found! Make sure you are logged in to YouTube."
        );
        return;
      }

      // Hand off to the UI builder.
      buildUI(items);
    }

    // Give the expanders a moment to take effect before starting extraction.
    setTimeout(extract, 400);
  }

  // ─────────────────────────────────────────────
  // Phase 3: Build the selection modal and handle export
  // ─────────────────────────────────────────────

  function buildUI(items) {
    /**
     * Utility: concise DOM element factory.
     *
     * @param {string}  tag       - HTML tag name
     * @param {Object}  props     - Attributes / style / textContent
     * @param {...Node} children  - Child nodes or strings
     * @returns {HTMLElement}
     */
    const h = (tag, props, ...children) => {
      const el = document.createElement(tag);

      for (let k in props || {}) {
        if (k === "style") Object.assign(el.style, props[k]);
        else if (k === "textContent") el.textContent = props[k];
        else if (k === "className") el.className = props[k];
        else if (k === "dataset") Object.assign(el.dataset, props[k]);
        else el.setAttribute(k, props[k]);
      }

      children.forEach((c) =>
        el.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
      );

      return el;
    };

    // ── Modal chrome ──

    // Semi-transparent backdrop — clicking it doesn't close the modal
    // (only the × button does).
    const bg = h("div", {
      id: "yre-bg",
      style: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.7)",
        zIndex: 99998,
      },
    });

    // Scrollable list container for feed checkboxes.
    const list = h("div", {
      style: {
        overflowY: "auto",
        flexGrow: 1,
        border: "1px solid #444",
        padding: "10px",
        borderRadius: "6px",
        background: "#222",
      },
    });

    // Live-filter input.
    const search = h("input", {
      type: "text",
      placeholder: "Search...",
      style: {
        padding: "10px",
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #444",
        background: "#111",
        color: "#fff",
        borderRadius: "6px",
        marginBottom: "15px",
      },
    });

    // Bulk selection buttons.
    const btnAll = h("button", {
      textContent: "Select All",
      style: {
        padding: "6px 12px",
        cursor: "pointer",
        background: "#333",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
      },
    });

    const btnNone = h("button", {
      textContent: "Select None",
      style: {
        padding: "6px 12px",
        cursor: "pointer",
        background: "#333",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
      },
    });

    // Primary action button.
    const btnExport = h("button", {
      textContent: "Download OPML",
      style: {
        marginTop: "15px",
        padding: "12px",
        background: "#cc0000",
        color: "#fff",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontWeight: "bold",
      },
    });

    // Close button (×).
    const btnClose = h("button", {
      textContent: "\u00D7", // × character
      style: {
        background: "none",
        border: "none",
        fontSize: "24px",
        cursor: "pointer",
        color: "#aaa",
      },
    });

    // Assemble the modal layout.
    const modal = h(
      "div",
      {
        style: {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "#1f1f1f",
          color: "#fff",
          padding: "20px",
          borderRadius: "12px",
          width: "600px",
          maxWidth: "90%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
          zIndex: 99999,
        },
      },
      // Header row: title + close button
      h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          },
        },
        h("h2", {
          textContent: `YouTube to OPML (${items.length} found)`,
          style: { margin: 0, fontSize: "18px" },
        }),
        btnClose
      ),
      search,
      // Button row
      h(
        "div",
        { style: { marginBottom: "10px", display: "flex", gap: "10px" } },
        btnAll,
        btnNone
      ),
      list,
      btnExport
    );

    document.body.appendChild(bg);
    document.body.appendChild(modal);

    // ── Populate the feed list, grouped by type ──

    const grouped = items.reduce((acc, it) => {
      (acc[it.type] = acc[it.type] || []).push(it);
      return acc;
    }, {});

    for (const [type, grpItems] of Object.entries(grouped)) {
      // Group header (e.g. "SUBSCRIPTIONS", "PLAYLISTS").
      const grp = h(
        "div",
        { className: "yre-group" },
        h("h3", {
          textContent: type + "s",
          style: {
            margin: "10px 0 5px 0",
            fontSize: "14px",
            color: "#aaa",
            textTransform: "uppercase",
            borderBottom: "1px solid #444",
            paddingBottom: "5px",
          },
        })
      );

      grpItems.forEach((it) => {
        const cb = h("input", {
          type: "checkbox",
          className: "yre-cb",
          value: it.url,
          dataset: { title: it.title, type: it.type },
          style: { marginRight: "10px" },
        });
        cb.checked = true; // Default: all feeds selected.

        grp.appendChild(
          h(
            "label",
            {
              className: "yre-item-row",
              dataset: { title: it.title },
              style: {
                display: "block",
                padding: "6px 0",
                cursor: "pointer",
                fontSize: "14px",
              },
            },
            cb,
            it.title
          )
        );
      });

      list.appendChild(grp);
    }

    // ── Event handlers ──

    // Live search: filter rows by title, hide empty groups.
    search.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();

      document.querySelectorAll(".yre-item-row").forEach((row) => {
        row.style.display = row.dataset.title.toLowerCase().includes(term)
          ? "block"
          : "none";
      });

      document.querySelectorAll(".yre-group").forEach((grp) => {
        grp.style.display = Array.from(
          grp.querySelectorAll(".yre-item-row")
        ).some((r) => r.style.display !== "none")
          ? "block"
          : "none";
      });
    });

    // Close modal and backdrop.
    btnClose.onclick = () => {
      bg.remove();
      modal.remove();
    };

    // Bulk check / uncheck.
    btnAll.onclick = () =>
      document.querySelectorAll(".yre-cb").forEach((cb) => (cb.checked = true));
    btnNone.onclick = () =>
      document
        .querySelectorAll(".yre-cb")
        .forEach((cb) => (cb.checked = false));

    // ── OPML export ──

    /**
     * Escape all five XML-sensitive characters.
     * Prevents malformed output from channel names like "Tom & Jerry"
     * or titles containing quotes.
     */
    const esc = (s) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    btnExport.onclick = () => {
      const selected = Array.from(
        document.querySelectorAll(".yre-cb:checked")
      );

      if (!selected.length) {
        return alert("No feeds selected!");
      }

      // Build the OPML XML string with proper formatting.
      // Many parsers (including Go's encoding/xml used by nom, Miniflux, etc.)
      // can fail on single-line XML with hundreds of attributes. Using newlines
      // and indentation avoids buffer-boundary issues and aids debugging.
      const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<opml version="1.0">',
        "  <head>",
        "    <title>YouTube Feeds</title>",
        "  </head>",
        "  <body>",
      ];

      // Get unique types from the selected checkboxes.
      const types = [...new Set(selected.map((cb) => cb.dataset.type))];

      types.forEach((type) => {
        // Each type gets a top-level outline node (e.g. "Subscriptions").
        lines.push(`    <outline text="${type}s" title="${type}s">`);

        selected
          .filter((cb) => cb.dataset.type === type)
          .forEach((cb) => {
            const t = esc(cb.dataset.title);
            const u = esc(cb.value);
            lines.push(
              `      <outline text="${t}" title="${t}" type="rss" xmlUrl="${u}" />`
            );
          });

        lines.push("    </outline>");
      });

      lines.push("  </body>", "</opml>");
      const xml = lines.join("\n");

      // Trigger a file download via a temporary object URL.
      const blobUrl = URL.createObjectURL(
        new Blob([xml], { type: "text/xml" })
      );
      const dl = document.createElement("a");
      dl.href = blobUrl;
      dl.download = "youtube_feeds.opml";
      dl.click();
      URL.revokeObjectURL(blobUrl);
    };
  }

  // Kick everything off.
  checkSidebar();
})();
