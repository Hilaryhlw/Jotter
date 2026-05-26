# Jotter

> *A quiet place to keep what books say to you.*

A Progressive Web App for readers — capture highlights, write journals, and weave ideas across books with tags.

## Features

- **📚 Bookshelf** — Responsive book grid (4 columns desktop, 2-3 mobile). Reading status badges.
- **🔍 ISBN Search** — Fetch book metadata from Google Books API. Manual fallback with cover upload.
- **✍️ Highlights** — Save quotes with multi-tag classification.
- **📓 Journal** — Per-book reading notes and summaries.
- **🧵 Thread** — Cross-book tag search with multi-tag intersection filtering and sort options.
- **📤 Export / Import** — Full JSON backup and restore. Device migration ready.
- **📱 PWA** — Offline-first with Service Worker. Add to Home Screen on iOS/Android.
- **💾 IndexedDB** — All data stored locally in your browser. Nothing sent to any server.

## Data Schema

```
books      { id, title, author, year, coverData, coverUrl, color, status, createdAt, updatedAt }
highlights { id, bookId, text, tags[], createdAt, updatedAt }
journals   { bookId, content, updatedAt }
```

## Deploy to GitHub Pages

1. Fork or clone this repository  
2. Go to **Settings → Pages → Deploy from branch → main → / (root)**  
3. Your app will be live at `https://yourusername.github.io/jotter/`

## Local Development

```bash
npx serve .
# or
python3 -m http.server 8080
```

## File Structure

```
jotter/
├── index.html     # Entire app (HTML + CSS + JS)
├── manifest.json  # PWA manifest
├── sw.js          # Service Worker for offline support
├── icon.svg       # App icon
└── README.md
```

---
*Jotter · MMXXVI*
