// rotty: the terminal. A back buffer the game's layout composes each frame,
// written out as truecolor cells, only those that changed; and keys read
// from the terminal, turned into the browser's keydown, keypress and keyup.

var TERM = {
    w: 80, h: 24,
    cells: null, prev: null,
    out: [],
    defaultFg: [204, 204, 204], defaultBg: [0, 0, 0],
    kitty: false
};

// ------------------------------------------------------------ colours

TERM.NAMED = {
    black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], lime: [0, 255, 0],
    blue: [0, 0, 255], yellow: [255, 255, 0], cyan: [0, 255, 255], aqua: [0, 255, 255], magenta: [255, 0, 255],
    fuchsia: [255, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192],
    maroon: [128, 0, 0], olive: [128, 128, 0], purple: [128, 0, 128], teal: [0, 128, 128], navy: [0, 0, 128],
    orange: [255, 165, 0], brown: [165, 42, 42], pink: [255, 192, 203], gold: [255, 215, 0],
    darkgray: [169, 169, 169], darkgrey: [169, 169, 169], lightgray: [211, 211, 211], lightgrey: [211, 211, 211],
    dimgray: [105, 105, 105], dimgrey: [105, 105, 105], darkred: [139, 0, 0], darkgreen: [0, 100, 0],
    darkblue: [0, 0, 139], lightblue: [173, 216, 230], violet: [238, 130, 238], indigo: [75, 0, 130],
    goldenrod: [218, 165, 32], tan: [210, 180, 140], beige: [245, 245, 220], salmon: [250, 128, 114],
    crimson: [220, 20, 60], khaki: [240, 230, 140], orchid: [218, 112, 214], chocolate: [210, 105, 30],
    transparent: null
};
TERM.colorCache = {};
// "#abc", "#aabbcc", "rgb(r, g, b)", "rgba(...)", a name, or [r, g, b]; null when unknown
TERM.color = function (c) {
    if (c == null || c === "") return null;
    if (Array.isArray(c)) return c;
    var hit = TERM.colorCache[c];
    if (hit !== undefined) return hit;
    var s = String(c).trim().toLowerCase(), v = null, m;
    if (s[0] == "#") {
        if (s.length == 4 || s.length == 5) v = [parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16), parseInt(s[3] + s[3], 16)];
        else if (s.length >= 7) v = [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)];
    } else if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s))) {
        v = [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])];
        if (m[4] !== undefined && +m[4] == 0) v = null;
    } else if ((m = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/.exec(s))) {
        var h = +m[1] / 360, sat = +m[2] / 100, l = +m[3] / 100;
        var f = function (n) { var k = (n + h * 12) % 12; var a = sat * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
        v = [f(0), f(8), f(4)];
    } else if (s in TERM.NAMED) v = TERM.NAMED[s];
    if (v && v.some(function (x) { return isNaN(x); })) v = null;
    TERM.colorCache[c] = v;
    return v;
};
TERM.mix = function (a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; };

// ------------------------------------------------------------ the screen

TERM.clear = function () {
    var n = TERM.w * TERM.h, bg = TERM.defaultBg;
    if (!TERM.cells || TERM.cells.length != n) {
        TERM.cells = new Array(n);
        for (var i = 0; i < n; i++) TERM.cells[i] = { ch: " ", fg: TERM.defaultFg, bg: bg, ul: false, bold: false };
    } else {
        for (var j = 0; j < n; j++) { var c = TERM.cells[j]; c.ch = " "; c.fg = TERM.defaultFg; c.bg = bg; c.ul = false; c.bold = false; }
    }
};
TERM.put = function (x, y, ch, fg, bg, ul, bold) {
    if (x < 0 || y < 0 || x >= TERM.w || y >= TERM.h) return;
    var c = TERM.cells[y * TERM.w + x];
    c.ch = ch == null || ch === "" ? " " : ch;
    c.fg = TERM.color(fg) || TERM.defaultFg;
    var b = TERM.color(bg);
    if (b) c.bg = b;
    c.ul = !!ul; c.bold = !!bold;
};
TERM.text = function (x, y, s, fg, bg, max) {
    s = String(s);
    var chars = Array.from(s);
    for (var i = 0; i < chars.length && (max == null || i < max); i++) TERM.put(x + i, y, chars[i], fg, bg);
    return chars.length;
};
TERM.fillRect = function (x, y, w, h, bg) {
    for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) TERM.put(i, j, " ", null, bg);
};
// a rot.js display's cells, from (sx, sy) of the canvas, at (dx, dy)
TERM.blit = function (canvas, dx, dy, sx, sy, w, h) {
    if (!canvas || !canvas.cols) return;
    sx = sx || 0; sy = sy || 0;
    if (w == null) w = canvas.cols - sx;
    if (h == null) h = canvas.rows - sy;
    for (var j = 0; j < h; j++) {
        var cy = sy + j;
        if (cy < 0 || cy >= canvas.rows) continue;
        for (var i = 0; i < w; i++) {
            var cx = sx + i;
            if (cx < 0 || cx >= canvas.cols) continue;
            var k = cy * canvas.cols + cx;
            var ul = canvas.cursor && canvas.cursor[0] == cx && canvas.cursor[1] == cy;
            TERM.put(dx + i, dy + j, canvas.ch[k], canvas.fg[k], canvas.bg[k], ul);
        }
    }
};

TERM.sgr = function (c) {
    return "\x1b[0;" + (c.bold ? "1;" : "") + (c.ul ? "4;" : "") + "38;2;" + c.fg[0] + ";" + c.fg[1] + ";" + c.fg[2] +
        ";48;2;" + c.bg[0] + ";" + c.bg[1] + ";" + c.bg[2] + "m";
};
TERM.flush = function () {
    var out = [], last = null, at = -1;
    var n = TERM.w * TERM.h;
    if (!TERM.prev || TERM.prev.length != n) { TERM.prev = new Array(n).fill(""); }
    for (var i = 0; i < n; i++) {
        var c = TERM.cells[i];
        var key = c.ch + "\x00" + c.fg + "\x00" + c.bg + "\x00" + c.ul + c.bold;
        if (TERM.prev[i] === key) continue;
        TERM.prev[i] = key;
        var x = i % TERM.w, y = (i / TERM.w) | 0;
        // every non-ASCII character re-positions the cursor after it, so a
        // terminal that draws one wider or narrower never shifts the row
        if (at != i) out.push("\x1b[" + (y + 1) + ";" + (x + 1) + "H");
        var s = TERM.sgr(c);
        if (s !== last) { out.push(s); last = s; }
        out.push(c.ch);
        at = c.ch.charCodeAt(0) < 128 && x + 1 < TERM.w ? i + 1 : -1;
    }
    if (out.length) TERM.write(out.join("") + "\x1b[0m");
};
TERM.write = function (s) {
    std.out.puts(s);
    std.out.flush();
};

// ------------------------------------------------------------ keys

// keyCode for a printed character, as US-layout browsers report it
TERM.CODES = {
    " ": 32, "0": 48, "1": 49, "2": 50, "3": 51, "4": 52, "5": 53, "6": 54, "7": 55, "8": 56, "9": 57,
    ")": 48, "!": 49, "@": 50, "#": 51, "$": 52, "%": 53, "^": 54, "&": 55, "*": 56, "(": 57,
    ";": 186, ":": 186, "=": 187, "+": 187, ",": 188, "<": 188, "-": 189, "_": 189, ".": 190, ">": 190,
    "/": 191, "?": 191, "`": 192, "~": 192, "[": 219, "{": 219, "\\": 220, "|": 220, "]": 221, "}": 221,
    "'": 222, "\"": 222
};
TERM.SHIFTED = ")!@#$%^&*(:+<_>?~{|}\"";
TERM.NUMPAD = { "1": 97, "2": 98, "3": 99, "4": 100, "5": 101, "6": 102, "7": 103, "8": 104, "9": 105 };
TERM.NAMES = { 8: "Backspace", 9: "Tab", 13: "Enter", 27: "Escape", 33: "PageUp", 34: "PageDown", 35: "End", 36: "Home",
    37: "ArrowLeft", 38: "ArrowUp", 39: "ArrowRight", 40: "ArrowDown", 45: "Insert", 46: "Delete" };

// a key from the terminal: a printed character (ch) or a keyCode (code)
TERM.key = function (ch, code, mods) {
    mods = mods || {};
    var shift = !!mods.shift, keyCode, charCode = 0, key, codeName;
    if (ch != null) {
        if (ch >= "a" && ch <= "z") { keyCode = ch.toUpperCase().charCodeAt(0); codeName = "Key" + ch.toUpperCase(); }
        else if (ch >= "A" && ch <= "Z") { keyCode = ch.charCodeAt(0); shift = true; codeName = "Key" + ch; }
        else {
            keyCode = TERM.CODES[ch] || ch.toUpperCase().charCodeAt(0);
            if (TERM.SHIFTED.indexOf(ch) != -1) shift = true;
            codeName = ch >= "0" && ch <= "9" ? "Digit" + ch : "";
            if (GAME.digitsAsNumpad && TERM.NUMPAD[ch] && !mods.ctrl) { keyCode = TERM.NUMPAD[ch]; codeName = "Numpad" + ch; }
        }
        key = ch;
        charCode = mods.ctrl ? 0 : ch.codePointAt(0);
    } else {
        keyCode = code;
        key = TERM.NAMES[code] || (code >= 112 && code <= 123 ? "F" + (code - 111) : "Unidentified");
        codeName = key;
        if (code == 13) charCode = 13;
    }
    var base = { keyCode: keyCode, which: keyCode, key: key, code: codeName, charCode: 0,
        shiftKey: shift, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, metaKey: false, repeat: false, location: 0 };
    if (AV.debug) AV.write("key " + JSON.stringify(key) + " keyCode=" + keyCode + (shift ? " shift" : "") + (mods.ctrl ? " ctrl" : "") + (mods.alt ? " alt" : ""));
    if (GAME.onKey && GAME.onKey(base) === false) return;
    var target = document.activeElement || document.body;
    var fire = function (type, extra) {
        var props = {};
        for (var p in base) props[p] = base[p];
        for (var q in extra) props[q] = extra[q];
        var e = new DOM.Event(type, props);
        e.target = target;
        // the browser's order: the element, then the document, then the window
        var ok = true;
        [target, document, window].forEach(function (t) { if (!e._stopped && t && t.dispatchEvent) ok = t.dispatchEvent(e) && ok; });
        return !e.defaultPrevented;
    };
    var go = fire("keydown", {});
    if (go && charCode && !mods.alt) fire("keypress", { charCode: charCode, keyCode: charCode, which: charCode });
    fire("keyup", {});
    DOM.touch();
};

// Bytes from the terminal: plain characters, control keys and the usual
// escape sequences (xterm and VT220 style, with modifiers)
TERM.feed = function (s) {
    var i = 0;
    while (i < s.length) {
        var c = s[i];
        if (c == "\x1b") {
            if (i + 1 >= s.length) { TERM.key(null, 27); i++; continue; }
            var rest = s.substr(i);
            var m = /^\x1b(?:\[|O)([<?>]?)([0-9;:]*)([A-Za-z~])/.exec(rest);
            if (m) { TERM.csi(m[1], m[2], m[3]); i += m[0].length; continue; }
            if (rest[1] == "\x1b") { TERM.key(null, 27); i++; continue; }
            // Alt + a character
            var ch2 = Array.from(rest.substr(1))[0];
            TERM.key(ch2, null, { alt: true });
            i += 1 + ch2.length;
            continue;
        }
        var code = c.charCodeAt(0);
        if (code == 3 || code == 17) { MAIN.quit(); return; }       // Ctrl+C, Ctrl+Q
        if (code == 13 || code == 10) TERM.key(null, 13);
        else if (code == 9) TERM.key(null, 9);
        else if (code == 127 || code == 8) TERM.key(null, 8);
        else if (code < 32) TERM.key(String.fromCharCode(code + 96), null, { ctrl: true });
        else {
            var cp = s.codePointAt(i), chr = String.fromCodePoint(cp);
            TERM.key(chr, null);
            i += chr.length;
            continue;
        }
        i++;
    }
};
TERM.csi = function (prefix, params, fin) {
    if (prefix == "?" && fin == "u") { TERM.kitty = true; return; }
    if (prefix == "<" && (fin == "M" || fin == "m")) return;   // a mouse report
    var p = params.split(";"), mod = p[1] ? (parseInt(p[1], 10) || 1) - 1 : 0;
    var mods = { shift: !!(mod & 1), alt: !!(mod & 2), ctrl: !!(mod & 4) };
    var map = { A: 38, B: 40, C: 39, D: 37, H: 36, F: 35, P: 112, Q: 113, R: 114, S: 115, E: 101, Z: 9 };
    if (fin == "Z") { TERM.key(null, 9, { shift: true }); return; }
    if (fin == "u") {   // kitty: CSI code ; mods u
        var cp = parseInt(p[0], 10);
        if (cp == 27) TERM.key(null, 27, mods);
        else if (cp == 13) TERM.key(null, 13, mods);
        else if (cp == 9) TERM.key(null, 9, mods);
        else if (cp == 127) TERM.key(null, 8, mods);
        else if (cp >= 32) TERM.key(String.fromCodePoint(cp), null, mods);
        return;
    }
    if (fin == "E") { TERM.key("5", null, mods); return; }     // the keypad's centre
    if (map[fin]) { TERM.key(null, map[fin], mods); return; }
    if (fin == "~") {
        var n = parseInt(p[0], 10);
        var tilde = { 1: 36, 2: 45, 3: 46, 4: 35, 5: 33, 6: 34, 7: 36, 8: 35, 11: 112, 12: 113, 13: 114, 14: 115, 15: 116,
            17: 117, 18: 118, 19: 119, 20: 120, 21: 121, 23: 122, 24: 123 };
        if (n == 200 || n == 201) return;   // bracketed paste markers
        if (tilde[n]) TERM.key(null, tilde[n], mods);
    }
};
