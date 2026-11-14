# Changes from upstream

This is the Asciiverse terminal edition of The Royal Wedding, Ondřej Žára's
introductory roguelike with a story, from github.com/ondras/trw (the
`upstream` remote; this branch, `asciiverse`, starts from its master at
`65d8a48`, 2021-05-11, with the full history). It is here by the author's
permission (`PERMISSION.md`).

**The game's own files are unchanged.** Everything new is in `asciiverse/`,
so upstream changes merge as they are; a README.md (upstream has none)
says how to play it with av.

## How it works

In the browser the page has the story on the left (with the current task,
then status and stats), the level on the right (one rot.js display per
level, sliding in from the side it is entered from) and a legend of what is
around you under it. rotty, the runtime written for Ondřej's rot.js games
(also in our Goldfish), runs the page's scripts unchanged:

- `asciiverse/rotty/`: the browser as far as these games use it (`dom.js`:
  `window`, a small element tree with `innerHTML`, selectors and events,
  `localStorage` in a file, `XMLHttpRequest` for `levels/*.txt`; `main.js`:
  rot.js's rectangular display backend drawing into terminal cells, the
  page's load event, the frame loop, saving; `term.js`: truecolor cells,
  keys turned into the browser's events with rot.js's keyCodes;
  `panel.js`: HTML text drawn into a box of the screen, words wrapped;
  `prelude.js`: timers and a console that writes to the log; `web.js`:
  the newer parts of the browser for Ondřej's later games, the same in
  every game on rotty).
- `asciiverse/game.js`: the page laid out on the screen as in the browser.
  The invitation is index.html's own `#intro`, centred, with its colours
  (blank rows of the scroll left out when the terminal is short). Then the
  story fills the left, about 38% of the width, with "The story so far..."
  and its arrows, the task in red, status in blue and stats in grey at the
  bottom; the current level on the right, scrolling to follow you, your own
  cell underlined as the browser draws it; the legend under it in columns.
- `asciiverse/build.py` and `asciiverse/Makefile`: index.html's scripts,
  in its order, become one classic script, run unchanged; the levels come
  along as strings; QuickJS-ng's `qjsc` makes one native program of about
  2 MB that needs nothing to run.

## Ours

- **Keys:** arrows, the numpad and vim keys as in the browser; the digits
  1 to 9 also walk, like the numpad. Page Up and Page Down (or `[` and
  `]`) leaf through the story, as the arrows beside "The story so far..."
  do with the mouse. Ctrl+C or Ctrl+Q quits.
- **A new game at the end:** the game asks to reload the page; here R
  starts again (the program starts itself again).
- **`--seed N`:** seeds rot.js's random numbers, so the forest and the
  dungeons grow the same each time (the preview uses it).
- **Session log:** `royal-wedding.log` in the state folder
  (`$XDG_STATE_HOME/royal-wedding`, `~/.local/state/royal-wedding`,
  Application Support on macOS, `%LOCALAPPDATA%` on Windows).
  `ROYAL_WEDDING_LOG=debug` records every key and a snapshot each second
  (screen size, your position, the level's size and scroll).

## Imported

- `asciiverse/quickjs/`: QuickJS-ng 0.17.0 as in our Candy Box 2 (one
  change in `quickjs-libc.c`: a signal interrupting `poll()` no longer ends
  the event loop), MIT.
- `asciiverse/ROT-LICENSE`: rot.js's licence (BSD-3-Clause), for the
  `js/common/rot.js` the game bundles.

## Packaging

- `.github/workflows/release.yml`: static Linux (musl, x86-64 and ARM64),
  macOS (x86-64 and ARM64) and Windows (x86-64, MinGW) archives plus
  SHA256SUMS, on tags `*-av.*`.
- `asciiverse/package.sh`: the archive (the program, PERMISSION.md,
  PATCHES.md, the licences).
- `asciiverse/record-preview.sh`: the 100x30 catalog preview, with hub's
  castrec.py.
