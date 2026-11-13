// rotty: start-up, the rot.js display patch, the frame loop, saving, and
// putting the terminal back. The game itself runs unchanged as a classic
// script (sloppy mode, its own globals), the way a browser loads it.

var MAIN = { started: false, saveTimer: null, storagePath: null, stateDir: null };

MAIN.home = function () { return std.getenv("HOME") || std.getenv("USERPROFILE") || "."; };
MAIN.mkdirs = function (p) {
    var parts = p.split("/"), cur = "";
    for (var i = 0; i < parts.length; i++) {
        cur += (i ? "/" : "") + parts[i];
        if (cur && cur != ".") os.mkdir(cur, 0o755);
    }
};
// the player's state folder: $XDG_STATE_HOME/<id>, ~/.local/state/<id>,
// ~/Library/Application Support/<id> on macOS, %LOCALAPPDATA%\<id> on Windows
MAIN.state = function () {
    var dir, x = std.getenv("XDG_STATE_HOME"), la = std.getenv("LOCALAPPDATA");
    if (x) dir = x + "/" + AV.id;
    else if (la) dir = la.replace(/\\/g, "/") + "/" + AV.id;
    else if (os.platform == "darwin") dir = MAIN.home() + "/Library/Application Support/" + AV.id;
    else dir = MAIN.home() + "/.local/state/" + AV.id;
    MAIN.mkdirs(dir);
    return dir;
};

MAIN.loadStorage = function () {
    MAIN.storagePath = MAIN.stateDir + "/localStorage.json";
    var f = std.open(MAIN.storagePath, "r");
    if (!f) return;
    try {
        var data = JSON.parse(f.readAsString());
        for (var k in data) localStorage._data[k] = String(data[k]);
    } catch (e) { AV.write("storage: " + e); }
    f.close();
};
MAIN.writeStorage = function () {
    if (!MAIN.storagePath) return;
    if (MAIN.saveTimer) { os.clearTimeout(MAIN.saveTimer); MAIN.saveTimer = null; }
    var tmp = MAIN.storagePath + ".tmp", f = std.open(tmp, "w");
    if (!f) return;
    f.puts(JSON.stringify(localStorage._data));
    f.close();
    os.rename(tmp, MAIN.storagePath);
};
MAIN.saveSoon = function () {
    if (MAIN.saveTimer) return;
    MAIN.saveTimer = os.setTimeout(function () { MAIN.saveTimer = null; MAIN.writeStorage(); }, 500);
};

// rot.js draws its cells through a backend onto a canvas; here every
// rectangular backend writes straight into the canvas's cell grid, one
// cell per character, and sizes are counted in cells
MAIN.patchRot = function () {
    if (typeof ROT == "undefined" || !ROT.Display) return;
    var R = ROT.Display.Rect && ROT.Display.Rect.prototype;
    if (R) {
        R.compute = function (o) {
            this._options = o;
            this._spacingX = 1; this._spacingY = 1;
            this._canvasWidth = o.width; this._canvasHeight = o.height;
            var c = this._context.canvas;
            if (c.cols != o.width || c.rows != o.height) c.resizeCells(o.width, o.height, o.bg);
        };
        R.draw = function (data, clearBefore) {
            var ch = data[2];
            if (Array.isArray(ch)) { var l = ch.filter(function (x) { return x && x != " "; }); ch = l.length ? l[l.length - 1] : " "; }
            this._context.canvas.put(data[0], data[1], ch, data[3], data[4]);
        };
        R.computeSize = function (w, h) { return [Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h))]; };
        R.computeFontSize = function () { return 15; };
        if (R._drawWithCache) R._drawWithCache = R.draw;
        if (R._drawNoCache) R._drawNoCache = R.draw;
    }
    if (GAME.patchRot) GAME.patchRot();
};

// ------------------------------------------------------------ terminal

MAIN.ON = "\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[?2004h\x1b[2J";
MAIN.OFF = "\x1b[0m\x1b[?2004l\x1b[?7h\x1b[?25h\x1b[?1049l";

MAIN.size = function (initial) {
    var s = os.ttyGetWinSize(1);
    if (!s || !(s[0] > 0) || !(s[1] > 0)) return;
    if (s[0] == TERM.w && s[1] == TERM.h && !initial) return;
    TERM.w = s[0]; TERM.h = s[1];
    TERM.prev = null;
    TERM.write("\x1b[0m\x1b[2J");
    if (window.screen) { screen.width = TERM.w; screen.height = TERM.h; }
    AV.write("size " + TERM.w + "x" + TERM.h);
    if (!initial) window.dispatchEvent(new DOM.Event("resize"));
    DOM.touch();
};

MAIN.utf8 = function (bytes, n) {
    var s = "", i = 0;
    while (i < n) {
        var c = bytes[i];
        if (c < 0x80) { s += String.fromCharCode(c); i++; continue; }
        var len = c >= 0xf0 ? 4 : c >= 0xe0 ? 3 : c >= 0xc0 ? 2 : 1;
        if (len == 1 || i + len > n) { i++; continue; }
        var cp = c & (0xff >> (len + 1));
        for (var k = 1; k < len; k++) cp = (cp << 6) | (bytes[i + k] & 0x3f);
        s += String.fromCodePoint(cp);
        i += len;
    }
    return s;
};

MAIN.frame = function () {
    TERM.clear();
    if (GAME.layout) GAME.layout();
    else MAIN.defaultLayout();
    TERM.flush();
};
// every canvas in the page, centred, one under the other
MAIN.defaultLayout = function () {
    var canvases = DOM.query(document, "canvas", false);
    var total = 0, maxw = 0;
    canvases.forEach(function (c) { total += c.rows; maxw = Math.max(maxw, c.cols); });
    var y = Math.max(0, ((TERM.h - total) / 2) | 0);
    canvases.forEach(function (c) {
        TERM.blit(c, Math.max(0, ((TERM.w - c.cols) / 2) | 0), y);
        y += c.rows;
    });
};

MAIN.start = function () {
    MAIN.started = true;
    os.ttySetRaw(0);
    TERM.write(MAIN.ON + "\x1b[?u");
    MAIN.size(true);
    var buf = new ArrayBuffer(4096), bytes = new Uint8Array(buf);
    os.setReadHandler(0, AV_guard(function () {
        var n = os.read(0, buf, 0, buf.byteLength);
        if (n <= 0) { MAIN.quit(); return; }
        TERM.feed(MAIN.utf8(bytes, n));
    }));
    try { os.signal(28, function () { MAIN.size(); }); } catch (e) {}
    try { [2, 15, 1].forEach(function (sig) { os.signal(sig, function () { os.setTimeout(MAIN.quit, 0); }); }); } catch (e) {}
    os.setTimeout(function tick() { os.setTimeout(tick, 500); MAIN.size(); }, 500);
    var frame = AV_guard(MAIN.frame);
    os.setTimeout(function loop() { os.setTimeout(loop, 33); frame(); }, 0);
    if (AV.debug) os.setTimeout(function snap() {
        os.setTimeout(snap, 1000);
        AV.write("snapshot " + TERM.w + "x" + TERM.h + (GAME.snapshot ? " " + GAME.snapshot() : ""));
        if (std.getenv("ROTTY_SCREEN")) {
            var rows = [];
            for (var y = 0; y < TERM.h; y++) { var r = ""; for (var x = 0; x < TERM.w; x++) r += TERM.cells[y * TERM.w + x].ch; rows.push(r.replace(/\s+$/, "")); }
            AV.write("screen\n" + rows.join("\n"));
        }
    }, 1000);
};

MAIN.restore = function () {
    if (!MAIN.started) return;
    MAIN.started = false;
    TERM.write((TERM.kitty ? "\x1b[<u" : "") + MAIN.OFF);
    try { os.ttySetRaw(0); } catch (e) {}
};

MAIN.quit = function (code) {
    MAIN.writeStorage();
    MAIN.restore();
    AV.write("quit");
    std.exit(code || 0);
};

// "reload the page": the program starts itself again
MAIN.reload = function () {
    MAIN.writeStorage();
    MAIN.restore();
    AV.write("reload");
    var args = scriptArgs.slice();
    try { os.exec(args, { usePath: false }); } catch (e) {}
    try { os.exec(args, { usePath: true }); } catch (e) {}
    std.exit(0);
};

MAIN.usage = function () {
    std.out.puts(GAME.usage || (AV.id + "\n"));
    std.exit(0);
};

MAIN.run = function () {
    AV.id = GAME.id;
    var args = scriptArgs.slice(1);
    for (var i = 0; i < args.length; i++) {
        if (args[i] == "--version") { std.out.puts(AV.id + " " + GAME.version + "\n"); std.exit(0); }
        else if (args[i] == "--help" || args[i] == "-h") MAIN.usage();
        else if (GAME.arg && GAME.arg(args[i], args[i + 1])) i++;
    }
    if (!os.isatty(1) || !os.isatty(0)) {
        std.err.puts(AV.id + " needs a terminal\n");
        std.exit(1);
    }
    MAIN.stateDir = MAIN.state();
    var lv = std.getenv("ROTTY_LOG") || std.getenv(AV.id.toUpperCase().replace(/-/g, "_") + "_LOG") || "";
    AV.debug = lv == "debug" || lv == "trace";
    AV.log = std.open(MAIN.stateDir + "/" + AV.id + ".log", AV.debug ? "w" : "a");
    AV.write("start " + AV.id + " " + GAME.version + (AV.debug ? " (debug)" : ""));
    MAIN.loadStorage();
    var s0 = os.ttyGetWinSize(1);
    if (s0) { TERM.w = s0[0]; TERM.h = s0[1]; }
    DOM.setupWindow();
    document.body.innerHTML = GAME.body || "";
    if (GAME.before) GAME.before();
    try {
        std.evalScript(GAME.source);
        MAIN.patchRot();
        if (GAME.ready) GAME.ready();
    } catch (e) {
        std.err.puts(AV.id + ": " + e + "\n" + (e.stack || "") + "\n");
        AV.write("fatal: " + e + "\n" + (e.stack || ""));
        std.exit(1);
    }
    MAIN.start();
    os.setTimeout(AV_guard(function () {
        document.readyState = "interactive";
        document.dispatchEvent(new DOM.Event("DOMContentLoaded"));
        document.readyState = "complete";
        document.dispatchEvent(new DOM.Event("readystatechange"));
        window.dispatchEvent(new DOM.Event("load"));
        if (GAME.loaded) GAME.loaded();
    }), 0);
};
