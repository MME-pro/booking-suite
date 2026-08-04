# Booking Suite — admin app

React interface for the WordPress admin screens under **Booking Suite**.

## Build

Requires Node.js 20+.

```bash
npm install
npm run build     # production bundle → build/
npm run start     # watch mode while developing
```

`wp-scripts` emits `build/index.js`, `build/index.css`, `build/index-rtl.css`
and `build/index.asset.php`. `frontend/admin/Assets.php` reads that manifest for
the script dependencies and cache-busting version — nothing is enqueued until
the bundle exists.

React and `@wordpress/*` packages are **not** bundled; they resolve to the
copies WordPress already ships.

## Layout

```
src/
  index.js                 mount point
  App.jsx                  picks the view handed over by PHP
  styles/
    tokens.css             design tokens — the one file a restyle touches
    base.css               resets and layout primitives
  components/              shared, page-agnostic
    AppBar  Badge  Button  Card  DataTable  EmptyState  SearchField
  pages/
    Apartments/
      ApartmentsPage.jsx
      components/          used by this page only
      data/                placeholder data until the REST layer exists
```

Every component lives in its own folder with a sibling `.css` file and an
`index.js` re-export, so imports stay `import { Button } from '../components'`.
