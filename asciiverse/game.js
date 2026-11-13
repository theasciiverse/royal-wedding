// The Royal Wedding in the terminal: how the page is laid out on the screen.
// As in the browser: the story on the left (status and stats under it), the
// level on the right, following you, and the legend of what is around you
// under the level.
/* BUILD {"files": ["levels/forest.txt", "levels/castle.txt", "levels/chapel.txt"], "inline": []} */

var GAME = {
    id: "royal-wedding",
    digitsAsNumpad: true,
    view: { x: 0, y: 0, level: null },
    usage: "royal-wedding [--seed N] [--version]\n\n" +
        "The Royal Wedding by Ondrej Zara, an introductory roguelike with a story, in\n" +
        "the terminal. Move with the arrows, the numpad, 1 to 9 or vim keys\n" +
        "(hjklyubn); . or 5 waits. Page Up and Page Down (or [ and ]) leaf through\n" +
        "the story. R starts again once the game is over. Ctrl+C or Ctrl+Q quits.\n" +
        "--seed N grows the same forest and dungeons each time. Best at 100x30.\n" +
        "ROYAL_WEDDING_LOG=debug logs every key to the state folder.\n"
};

// the page's colours (css/*.css): the body's amber text, the task in red,
// status in blue, stats in grey
GAME.css = function (n) {
    if (n.id == "task") return { fg: "#f33", block: true };
    if (n.id == "status") return { fg: "#57f", block: true };
    if (n.id == "stats") return { fg: "#aaa", block: true };
    if (n.id == "current") return { block: true };
    if (n.classList && n.classList.contains("crit")) return { fg: "#f33" };
    if (n.tagName == "P" && n.parentNode && n.parentNode.id == "current") return { gap: true };
    if (n.classList && n.classList.contains("fade")) return null;
    return null;
};

// the invitation, index.html's #intro, centred; empty rows of the scroll
// are left out when the terminal is not tall enough for all of it
GAME.intro = function (node) {
    var lines = node.textContent.replace(/^\n/, "").split("\n");
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    var runs = PANEL.lines(node, 1000, { fg: "#b82" });
    // colours per character from the markup: walk the same text again
    var colored = [], cur = [];
    var walk = function (n, fg) {
        if (n.nodeType == 3) {
            for (var ch of Array.from(n.data)) {
                if (ch == "\n") { colored.push(cur); cur = []; } else cur.push([ch, fg]);
            }
            return;
        }
        var f = n.tagName == "SPAN" ? "#863" : n.tagName == "STRONG" ? "#eee" : n.tagName == "A" ? "#999" : fg;
        n.childNodes.forEach(function (c) { walk(c, f); });
    };
    walk(node, "#b82");
    colored.push(cur);
    if (colored.length && !colored[0].length) colored.shift();
    while (colored.length && !colored[colored.length - 1].map(function (c) { return c[0]; }).join("").trim()) colored.pop();
    var plain = function (l) { return l.map(function (c) { return c[0]; }).join(""); };
    while (colored.length > TERM.h) {
        var mid = colored.length >> 1, cut = -1;
        for (var d = 0; d < colored.length && cut < 0; d++) {
            [mid + d, mid - d].forEach(function (i) {
                if (cut < 0 && i > 0 && i < colored.length - 1 && /^\s*\|\s*\|\s*$/.test(plain(colored[i]))) cut = i;
            });
        }
        if (cut < 0) break;
        colored.splice(cut, 1);
    }
    var w = 0;
    colored.forEach(function (l) { w = Math.max(w, l.length); });
    var x0 = Math.max(0, ((TERM.w - w) / 2) | 0), y0 = Math.max(0, ((TERM.h - colored.length) / 2) | 0);
    colored.forEach(function (l, j) {
        l.forEach(function (c, i) { TERM.put(x0 + i, y0 + j, c[0], c[1], null); });
    });
};

GAME.layout = function () {
    var intro = document.getElementById("intro");
    if (intro) { GAME.intro(intro); return; }
    var W = TERM.w, H = TERM.h;
    var left = Math.max(28, Math.min(48, Math.round(W * 0.38)));
    var rx = left + 1, rw = W - rx;
    var legendH = Math.max(3, Math.round(H * 0.2)), levelH = H - legendH;

    // the level, following the player
    var level = Game.level;
    if (level && level._display) {
        var c = level._display.getContainer(), v = GAME.view;
        c.cursor = level._display._cursor ? level._display._cursor.split(",").map(Number) : null;
        var vw = Math.min(rw, c.cols), vh = Math.min(levelH, c.rows);
        var p = Game.player && Game.player.getPosition && Game.player.getPosition();
        if (p && p[0] !== null && p[0] !== undefined) {
            if (v.level != level) { v.level = level; v.x = p[0] - (vw >> 1); v.y = p[1] - (vh >> 1); }
            // scroll when the player gets within a quarter of the edge
            var mx = Math.max(1, vw >> 2), my = Math.max(1, vh >> 2);
            if (p[0] - v.x < mx) v.x = p[0] - mx;
            if (p[0] - v.x > vw - 1 - mx) v.x = p[0] - (vw - 1 - mx);
            if (p[1] - v.y < my) v.y = p[1] - my;
            if (p[1] - v.y > vh - 1 - my) v.y = p[1] - (vh - 1 - my);
            v.x = Math.max(0, Math.min(c.cols - vw, v.x));
            v.y = Math.max(0, Math.min(c.rows - vh, v.y));
        }
        var ox = rx + Math.max(0, ((rw - c.cols) / 2) | 0), oy = Math.max(0, ((levelH - c.rows) / 2) | 0);
        TERM.blit(c, ox, oy, v.x, v.y, vw, vh);
    }

    // the story so far, with its task; status and stats at the bottom
    var story = document.getElementById("story");
    var prev = document.getElementById("prev"), next = document.getElementById("next");
    var shown = function (a) { return a && a.style.opacity !== 0 && a.style.opacity !== "0"; };
    var y = 0;
    TERM.text(1, y, shown(prev) ? "◀" : " ", "#b82");
    var title = "The story so far...";
    TERM.text(((left - title.length) / 2) | 0, y, title, "#b82");
    TERM.put(left - 2, y, shown(next) ? "▶" : " ", "#b82");
    y += 2;
    var bottomLines = function (el, w) { return el ? PANEL.lines(el, w, { fg: "#b82" }).length : 0; };
    var status = document.getElementById("status"), stats = document.getElementById("stats");
    var stH = bottomLines(stats, left - 2), suH = bottomLines(status, left - 2);
    var bottomTop = H - stH - (suH ? suH + 1 : 0);
    var current = document.getElementById("current"), task = document.getElementById("task");
    var taskH = bottomLines(task, left - 2);
    var room = Math.max(1, bottomTop - 1 - y - (taskH ? taskH + 1 : 0));
    y += PANEL.draw(current, 1, y, left - 2, room, { fg: "#b82" }, true);
    if (taskH) { y++; PANEL.draw(task, 1, y, left - 2, Math.max(1, bottomTop - 1 - y), { fg: "#f33" }); }
    if (suH) PANEL.draw(status, 1, bottomTop, left - 2, suH, { fg: "#57f" });
    if (stH) PANEL.draw(stats, 1, H - stH, left - 2, stH, { fg: "#aaa" });

    // the legend: what is around you, in columns
    var legend = document.getElementById("legend");
    if (legend) {
        var items = legend.children, colw = 22, cols = Math.max(1, Math.floor((rw - 1) / colw));
        var ly = levelH;
        items.forEach(function (p, i) {
            var spans = p.children;
            if (!spans.length) return;
            var x = rx + 1 + (i % cols) * colw, yy = ly + ((i / cols) | 0);
            if (yy >= H) return;
            TERM.put(x, yy, spans[0].textContent, spans[0].style.color || "#777");
            TERM.text(x + 1, yy, (spans[1] ? spans[1].textContent : "").slice(0, colw - 2), "#777");
        });
    }
};

GAME.patchRot = function () {
    // the player's cell is underlined (the browser draws a line under it)
    if (ROT.Display.RectCursor) ROT.Display.RectCursor.prototype.drawCursor = function () {};
};

// Page Up / Page Down (or [ and ]) leaf through the story, as the arrows
// beside "The story so far..." do; R starts again once the game is over
GAME.onKey = function (e) {
    var click = function (id) {
        var a = document.getElementById(id);
        if (a) a.dispatchEvent(new DOM.Event("click", { target: a }));
    };
    if (e.keyCode == 33 || e.key == "[") { click("prev"); return false; }
    if (e.keyCode == 34 || e.key == "]") { click("next"); return false; }
    var over = typeof Game != "undefined" && Game.player && (Game.player._ended || (Game.player.getHP && Game.player.getHP() <= 0));
    if (over && (e.key == "r" || e.key == "R")) { MAIN.reload(); return false; }
};

GAME.snapshot = function () {
    var p = typeof Game != "undefined" && Game.player && Game.player.getPosition && Game.player.getPosition();
    return "player=" + (p ? p.join(",") : "-") + " view=" + GAME.view.x + "," + GAME.view.y +
        " level=" + (Game.level && Game.level._display ? Game.level._display.getContainer().cols + "x" + Game.level._display.getContainer().rows : "-");
};

// --seed N: the same forest and dungeons every time (for the preview)
GAME.seed = null;
GAME.arg = function (a, b) {
    if (a == "--seed" && b) { GAME.seed = parseInt(b, 10); return true; }
    return false;
};
GAME.ready = function () {
    if (GAME.seed !== null && ROT.RNG.setSeed) ROT.RNG.setSeed(GAME.seed);
};
