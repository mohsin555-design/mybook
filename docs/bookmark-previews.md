# Bookmark previews

The paste menu and link Change to menus include Mention. Website mentions reuse the bookmark node with `appearance: "mention"`, showing the favicon, website name (Open Graph site name, falling back to the domain), and muted page title in a compact row. This appearance and site name survive Markdown round trips. User mentions are not implemented.

Bookmarks request `/api/bookmark-metadata?url=...` to read the public page's Open Graph, Twitter card, or HTML title and description. The endpoint runs as a Vercel function and is also available in Vite development and preview servers. No environment variables are required. Static-only hosting needs an equivalent endpoint.

The original bookmark URL remains the destination and visible URL, including its query parameters. Preview images are saved in the document and Markdown export. Missing, loading, or failed images display a centered InternetIcon on a subtle grey background. Pages that block fetching or require sign-in keep the existing bookmark text.

`parse5` parses page metadata without executing scripts. Server requests are limited to public IPv4 addresses on standard HTTP/HTTPS ports; DNS addresses are pinned, redirects revalidated, and response size and request time bounded. IPv6-only sites do not currently resolve. Client metadata requests are deduplicated within the session.

## Module references and verification

Client implementation lives in `src/services/bookmarkMetadata.ts`, `BookmarkBlockNodeView.tsx`, `bookmarkClipboard.ts`, and `extensions/BookmarkBlock.ts` under `src/components/document-editor/`. The endpoint is implemented in `server/bookmarkMetadata.ts` and exposed by `api/bookmark-metadata.ts`; Vite mounts it in development/preview.

Tests cover the metadata server, bookmark clipboard and node view, plus Markdown serialization. Verify blocked pages, redirects, missing images, query-string preservation and website-mention round trips. Live remote metadata is unavailable offline, and provider content can change. User mentions remain outside this feature.

See [advanced editor blocks](./advanced-editor-and-format-spec.md) for related embed/document-link modules.
