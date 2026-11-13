#!/bin/sh
# Records the catalog preview, asciiverse/royal-wedding.cast, at 100x30 with
# hub's castrec.py: the invitation, the pier at night, the torch, then the
# forest (grown from --seed 3), leafing back through the story on the way.
# Run from the repo root after building.
set -eu
CASTREC=${CASTREC:-../../hub/tools/castrec.py}
state=$(mktemp -d)
trap 'rm -rf "$state"' EXIT
S="w5;kx;w4"
S="$S;kup;w0.8;kup;w1.5;r5:right:0.45;w1;kdown;w4"
S="$S;r4:n:0.4;r7:j:0.4;w1;r8:right:0.4;w2"
S="$S;k[;w3;k];w2"
S="$S;r10:right:0.4;w2;r9:right:0.4;w4"
XDG_STATE_HOME="$state" python3 "$CASTREC" "${1:-asciiverse/royal-wedding.cast}" . "$S" -- ./out/royal-wedding --seed 3
