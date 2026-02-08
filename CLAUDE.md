# Between Pages

A reading journal web app where users add short thoughts after reading books, to track and motivate reading. Built as a single-file PWA with offline-first localStorage and optional cloud sync via Supabase.

---

## Features / Modules

### Home View (Timeline)
- Books displayed in a 2-column grid, grouped by year read
- Sticky header with logo and account indicator (avatar + dropdown)
- Floating year indicator appears while scrolling (auto-hides after 1.5s)
- FAB "+" button (bottom-right) navigates to Add Book view
- Empty state shown when no books exist
- Adjacent book covers are preloaded for smooth navigation

### Add Book View
- **Search tab**: Queries Open Library API + Google Books API simultaneously
  - Detects Chinese characters and adjusts query strategy for Traditional/Simplified Chinese
  - Deduplicates results by first 20 characters of title; max 20 results
- **Manual tab**: Title (required), author, year read, cover upload (file or URL)
- Selecting a search result or submitting manual form creates the book and opens the Edit View

### Book View (Fullscreen Display)
- Black background with centered cover image + blurred background layer
- Text boxes rendered at saved positions with custom fonts, colors, and sizes
- **Tap interactions**:
  - First tap: Info overlay (title, author, year read) + "more" button
  - Second tap / more button: Action menu (edit / delete)
- **Swipe left/right**: 3D cube transition to adjacent books (90-degree rotate, 400ms, 28% threshold)
- **Swipe down**: Instagram Stories-style close with progressive scale + opacity (25% threshold)
- Delete confirmation via modal dialog

### Edit View (Stories-Style Editor)
- Fullscreen black background with cover + blurred background
- **Stories toolbar** (top center, blurred backdrop):
  - Font style picker: Classic (Courier Prime), Modern (Helvetica Neue), Elegant (Georgia)
  - Text color button with circle indicator
  - Background color button with highlight icon
  - Eyedropper button (native API on desktop, touch-based canvas sampling on mobile)
  - Done button to dismiss keyboard
- **Text boxes**:
  - Tap empty space to create a new text box at that position
  - Tap existing text box to enter edit mode (textarea with auto-grow)
  - Drag to reposition; drop on trash icon (bottom center) to delete
  - Pinch-to-resize font size (range: 12-48px)
  - Background color + auto text color (light/dark detection), or manual text color override
  - Blur or Done saves text; empty text boxes are automatically removed
- **Color picker**: 16-color standard palette + 6 colors extracted from cover image (quantized sampling)
- Save button commits all text boxes to the book object

### Text Box Data Model
Each text box stores: `text`, `x`, `y`, `color` (background), `textColor`, `fontStyle` (0-2), `fontSize`

### Workflow
1. Add book (search or manual) -> lands in Edit View
2. Add text boxes with thoughts/reflections -> Save
3. Browse timeline on Home -> tap to open Book View
4. Swipe between books or swipe down to return home
5. Edit anytime via the action menu in Book View

---

## UX Principles / Guidelines

- **Mobile-first design** -- iPhone is the priority device
- Max container width: 480px; responsive within that
- Monospace typography (Courier Prime) with warm brown color palette
- Lowercase headers with wide letter-spacing for a literary aesthetic
- Touch-optimized: swipe gestures, pinch-to-resize, drag-and-drop
- iOS PWA support: safe-area insets, `viewport-fit=cover`, no user-scalable zoom
- Animations should feel organic: scale transitions, opacity fades, 3D cube rotations
- Visual keyboard handling: `visualViewport` resize listener prevents scroll jumps on iOS
- History API (`pushState`/`popstate`) for proper back-button navigation between views

---

## Known Issues

- **CORS eyedropper failure**: Touch-based eyedropper fails silently if the cover image is CORS-protected; falls back to the standard color picker
- **Base64 cover bloat**: Large images stored as base64 in localStorage can approach the ~5-10MB origin limit; Supabase sync converts these to Storage URLs, but offline-only users may hit the cap
- **Sync race conditions**: If the offline queue processes while a realtime subscription fires, duplicate writes are possible (mitigated by `lastSyncedBookId` guard but not fully prevented)
- **Color picker state leakage**: `colorPickerMode` is not reset when switching between text boxes; may retain the previous mode unexpectedly
- **Text box z-index overlap**: All static text boxes share z-index 15; overlapping boxes may not layer predictably
- **Image crossOrigin inconsistency**: Some code paths set `crossOrigin="anonymous"`, others remove it on error, leading to mixed behavior
- **Year field validation**: Accepts any string, not validated as a 4-digit year
- **iOS keyboard scroll workaround**: Edit view uses aggressive `scrollTo(0,0)` to prevent iOS scroll jumps -- unusual but necessary
- **Supabase anon key exposed**: The Supabase anonymous key is embedded in the client code (acceptable for anon-key-level access, but row-level security on the database is required)

---

## Developer Notes

### Technologies
- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework, no build step)
- **Font**: Google Fonts -- Courier Prime (monospace)
- **Data storage**: localStorage (`between_pages_books_v5` key)
- **Cloud sync**: Supabase (JS client loaded via CDN `@supabase/supabase-js@2`)
- **Auth**: Supabase Google OAuth with skip option
- **Book search APIs**: Open Library (`openlibrary.org/search.json`) + Google Books (`googleapis.com/books/v1/volumes`)
- **Cover images**: Open Library covers (`covers.openlibrary.org`) or Google Books `imageLinks`
- **PWA**: Service worker (`sw.js`) + Web App Manifest (`manifest.json`)

### File Structure
```
reading-journal-web/
  index.html          # ~5400 lines -- entire app (HTML + CSS + JS inline)
  sw.js               # Service worker (cache-first for app shell, network-first for APIs)
  manifest.json       # PWA manifest (icons, theme color, display mode)
  icons/              # App icons in multiple sizes (72-512px + maskable)
  generate-icons.html # Utility for generating icon assets
```

### API Considerations
- **Open Library**: No API key required; rate limits are generous. Best for English titles.
- **Google Books**: No API key used (public endpoint); supports Traditional Chinese better than Open Library. HTTP cover URLs are converted to HTTPS.
- **Supabase**: Anon key is public; all data access must be protected by Row Level Security (RLS) policies filtering on `user_id`. Realtime subscriptions filter by authenticated user ID.

### Data Architecture
- **Local-first**: All reads/writes go to localStorage first; Supabase sync is async and optional
- **Book IDs**: `book_` prefix + `crypto.randomUUID()` to avoid cross-device collisions
- **Sample books**: 9 demo books with IDs prefixed `sample_`; never synced to Supabase
- **Offline queue**: Failed sync operations are queued in `bp_offline_queue` (localStorage) and retried on `online` event
- **Cover upload flow**: Base64 in localStorage -> on sync, uploaded to Supabase Storage (`covers/{userId}/{bookId}.jpg`) -> URL replaces base64 in book object
- **Backward compatibility**: Legacy `reflection`, `textBoxColor`, `textBoxX`, `textBoxY` fields are still read and migrated to the `textBoxes` array format

### Supabase Sync Details
- **Merge strategy**: Remote wins for conflicts; local-only books are preserved
- **Realtime**: Postgres changes subscription on `public.books` table, filtered by user ID
- **Migration**: On first sign-in, all existing localStorage books are uploaded to Supabase
- **DB column mapping**: camelCase JS fields <-> snake_case database columns (`bookToRow()` / `rowToBook()`)

---

## Important Conventions

- This is a **single-file app** -- all CSS and JS live inline in `index.html`. Do not split into separate files.
- Book objects live in a flat array in localStorage under the key `between_pages_books_v5`.
- Views are toggled by adding/removing the `.active` class; there is no router.
- Touch event handling includes iOS-specific workarounds (500ms guard on toolbar touches, `scrollTo(0,0)` during editing, `visualViewport` resize listener).
- Color brightness detection uses the formula `(R*299 + G*587 + B*114) / 1000`; threshold 180 separates light (dark text) from dark (light text).
- The warm brown palette (#5c4d3d primary, #faf8f5 background, #8b7355/#a89078 accents) is central to the brand -- maintain it in any new UI.
- Service worker cache version (`CACHE_VERSION` in `sw.js`) must be bumped when `index.html` changes to force refresh.
