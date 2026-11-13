// rotty: HTML text drawn into a box of the terminal, for the side panels
// rot.js games keep beside their display (story, status, legend). Block
// elements (p, div, li, h1 to h6) start a new line, <br> breaks one, words
// wrap at the box's width. Colours come from each element's style.color,
// else from GAME.css(element), else from the parent.

var PANEL = {};
PANEL.BLOCK = { P: 1, DIV: 1, LI: 1, UL: 1, OL: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, SECTION: 1, PRE: 1, TABLE: 1, TR: 1 };

// the element's text as lines of runs: [[{t, fg, bold}], ...] at width w
PANEL.lines = function (el, w, base) {
    var lines = [[]], col = 0;
    var newline = function () { lines.push([]); col = 0; };
    var cur = function () { return lines[lines.length - 1]; };
    var put = function (word, st) {
        var len = Array.from(word).length;
        if (col && col + len > w && word != " ") newline();
        if (!col && word == " ") return;
        while (len > w) {   // a word longer than the box
            var head = Array.from(word).slice(0, w - col).join("");
            cur().push({ t: head, fg: st.fg, bold: st.bold });
            newline();
            word = Array.from(word).slice(w - col).join(""); len = Array.from(word).length;
        }
        cur().push({ t: word, fg: st.fg, bold: st.bold });
        col += len;
    };
    var walk = function (n, st) {
        if (n.nodeType == 3) {
            var words = n.data.replace(/\s+/g, " ").split(/( )/);
            for (var i = 0; i < words.length; i++) if (words[i]) put(words[i], st);
            return;
        }
        if (n.nodeType != 1 && n.nodeType != 11) return;
        if (n.style && (n.style.display == "none" || n.style.visibility == "hidden" || n.style.opacity === 0 || n.style.opacity === "0")) return;
        var css = GAME.css ? GAME.css(n) || {} : {};
        if (css.hidden) return;
        var s = { fg: (n.style && n.style.color) || css.fg || st.fg, bold: css.bold || n.tagName == "STRONG" || n.tagName == "B" || st.bold };
        if (n.tagName == "BR") { newline(); return; }
        var block = PANEL.BLOCK[n.tagName] || css.block;
        if (block && col) newline();
        if (css.before) put(css.before, s);
        n.childNodes.forEach(function (c) { walk(c, s); });
        if (css.after) put(css.after, s);
        if (block && col) newline();
        if (block && css.gap) newline();
    };
    walk(el, base || { fg: null, bold: false });
    while (lines.length && !lines[lines.length - 1].length) lines.pop();
    return lines;
};

// draws el into the box; "bottom" keeps the last lines when it is too tall.
// Returns the number of lines drawn
PANEL.draw = function (el, x, y, w, h, base, bottom) {
    if (!el || w <= 0 || h <= 0) return 0;
    var lines = PANEL.lines(el, w, base);
    if (lines.length > h) lines = bottom ? lines.slice(lines.length - h) : lines.slice(0, h);
    lines.forEach(function (runs, j) {
        var cx = x;
        runs.forEach(function (r) {
            Array.from(r.t).forEach(function (ch) {
                if (cx < x + w) TERM.put(cx, y + j, ch, r.fg, null, false, r.bold);
                cx++;
            });
        });
    });
    return lines.length;
};
