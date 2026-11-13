// rotty: as much of the browser as rot.js games use. The window is the
// global object, as in a browser; one "pixel" is one terminal cell, so a
// rot.js display sized from window.innerWidth gets one character per cell.

var DOM = {};

DOM.listen = function (target) {
    target._listeners = {};
    target.addEventListener = function (type, l) {
        if (!l) return;
        var list = this._listeners[type] || (this._listeners[type] = []);
        if (list.indexOf(l) == -1) list.push(l);
    };
    target.removeEventListener = function (type, l) {
        var list = this._listeners[type];
        if (!list) return;
        var i = list.indexOf(l);
        if (i != -1) list.splice(i, 1);
    };
    target.dispatchEvent = function (e) {
        if (!e.target) e.target = this;
        e.currentTarget = this;
        var list = (this._listeners[e.type] || []).slice();
        for (var i = 0; i < list.length && !e._stopped; i++) {
            var l = list[i];
            AV_guard(function () {
                if (typeof l == "function") l.call(target, e);
                else if (l && l.handleEvent) l.handleEvent(e);
            })();
        }
        var on = this["on" + e.type];
        if (typeof on == "function" && !e._stopped) AV_guard(function () { on.call(target, e); })();
        return !e.defaultPrevented;
    };
};

DOM.Event = function (type, props) {
    this.type = type;
    this.defaultPrevented = false;
    this._stopped = false;
    this.timeStamp = Date.now();
    for (var p in props) this[p] = props[p];
};
DOM.Event.prototype.preventDefault = function () { this.defaultPrevented = true; };
DOM.Event.prototype.stopPropagation = function () { this._stopped = true; };
DOM.Event.prototype.stopImmediatePropagation = function () { this._stopped = true; };

// ---------------------------------------------------------------- elements

DOM.Text = function (text) {
    this.nodeType = 3;
    this.nodeName = "#text";
    this.data = text;
    this.parentNode = null;
};
DOM.Text.prototype.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
Object.defineProperty(DOM.Text.prototype, "parentElement", { get: function () { return this.parentNode; } });
Object.defineProperty(DOM.Text.prototype, "textContent", {
    get: function () { return this.data; },
    set: function (v) { this.data = String(v); DOM.touch(); }
});
Object.defineProperty(DOM.Text.prototype, "nodeValue", {
    get: function () { return this.data; },
    set: function (v) { this.data = String(v); DOM.touch(); }
});

DOM.Element = function (tag) {
    this.nodeType = 1;
    this.tagName = this.nodeName = String(tag).toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    var self = this;
    this.classList = {
        add: function () { for (var i = 0; i < arguments.length; i++) if (!this.contains(arguments[i])) self.className = (self.className + " " + arguments[i]).trim(); DOM.touch(); },
        remove: function () { for (var i = 0; i < arguments.length; i++) { var c = arguments[i]; self.className = self.className.split(/\s+/).filter(function (x) { return x && x != c; }).join(" "); } DOM.touch(); },
        contains: function (c) { return self.className.split(/\s+/).indexOf(c) != -1; },
        toggle: function (c, force) {
            var on = force === undefined ? !this.contains(c) : !!force;
            if (on) this.add(c); else this.remove(c);
            return on;
        }
    };
    this.className = "";
    this.id = "";
    DOM.listen(this);
};

DOM.touch = function () { DOM.dirty = true; };

// an inline style="color: #f33; display: none" into the element's style
DOM.parseStyle = function (text, style) {
    String(text).split(";").forEach(function (decl) {
        var i = decl.indexOf(":");
        if (i < 0) return;
        var k = decl.slice(0, i).trim().toLowerCase().replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
        if (k) style[k] = decl.slice(i + 1).trim();
    });
};

(function (P) {
    P.appendChild = function (n) {
        if (n.nodeType == 11) { var kids = n.childNodes.slice(); for (var i = 0; i < kids.length; i++) this.appendChild(kids[i]); return n; }
        if (n.parentNode) n.parentNode.removeChild(n);
        n.parentNode = this;
        this.childNodes.push(n);
        DOM.touch();
        return n;
    };
    P.insertBefore = function (n, ref) {
        if (!ref) return this.appendChild(n);
        if (n.parentNode) n.parentNode.removeChild(n);
        var i = this.childNodes.indexOf(ref);
        n.parentNode = this;
        this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, n);
        DOM.touch();
        return n;
    };
    P.removeChild = function (n) {
        var i = this.childNodes.indexOf(n);
        if (i != -1) this.childNodes.splice(i, 1);
        n.parentNode = null;
        DOM.touch();
        return n;
    };
    P.replaceChild = function (n, old) { this.insertBefore(n, old); this.removeChild(old); return old; };
    P.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
    P.cloneNode = function (deep) {
        var c = document.createElement(this.tagName);
        c.className = this.className; c.id = this.id;
        for (var a in this.attributes) c.attributes[a] = this.attributes[a];
        if (c.attributes.style) DOM.parseStyle(c.attributes.style, c.style);
        if (deep) c.innerHTML = this.innerHTML;
        return c;
    };
    P.setAttribute = function (k, v) {
        v = String(v);
        if (k == "class") this.className = v;
        else if (k == "id") this.id = v;
        else if (k == "style") DOM.parseStyle(v, this.style);
        this.attributes[k] = v;
        DOM.touch();
    };
    P.getAttribute = function (k) {
        if (k == "class") return this.className;
        if (k == "id") return this.id || null;
        return k in this.attributes ? this.attributes[k] : null;
    };
    P.hasAttribute = function (k) { return this.getAttribute(k) !== null; };
    P.removeAttribute = function (k) { delete this.attributes[k]; if (k == "class") this.className = ""; };
    P.getBoundingClientRect = function () {
        var b = GAME_box(this);
        return { left: b.x, top: b.y, right: b.x + b.w, bottom: b.y + b.h, width: b.w, height: b.h, x: b.x, y: b.y };
    };
    P.focus = function () {}; P.blur = function () {};
    P.scrollIntoView = function () {};
    P.querySelector = function (s) { return DOM.query(this, s, true); };
    P.querySelectorAll = function (s) { return DOM.query(this, s, false); };
    P.getElementsByTagName = function (t) { return DOM.query(this, t, false); };
    P.getElementsByClassName = function (c) { return DOM.query(this, "." + c, false); };
    P.contains = function (n) { while (n) { if (n == this) return true; n = n.parentNode; } return false; };

    Object.defineProperty(P, "children", { get: function () { return this.childNodes.filter(function (n) { return n.nodeType == 1; }); } });
    Object.defineProperty(P, "firstChild", { get: function () { return this.childNodes[0] || null; } });
    Object.defineProperty(P, "lastChild", { get: function () { return this.childNodes[this.childNodes.length - 1] || null; } });
    Object.defineProperty(P, "firstElementChild", { get: function () { return this.children[0] || null; } });
    Object.defineProperty(P, "lastElementChild", { get: function () { var c = this.children; return c[c.length - 1] || null; } });
    Object.defineProperty(P, "childElementCount", { get: function () { return this.children.length; } });
    Object.defineProperty(P, "parentElement", { get: function () { var p = this.parentNode; return p && p.nodeType == 1 ? p : null; } });
    Object.defineProperty(P, "nextElementSibling", { get: function () { var p = this.parentNode; if (!p) return null; var c = p.children; return c[c.indexOf(this) + 1] || null; } });
    Object.defineProperty(P, "previousElementSibling", { get: function () { var p = this.parentNode; if (!p) return null; var c = p.children; return c[c.indexOf(this) - 1] || null; } });
    Object.defineProperty(P, "nextSibling", { get: function () { var p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) + 1] || null; } });
    Object.defineProperty(P, "previousSibling", { get: function () { var p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) - 1] || null; } });
    Object.defineProperty(P, "textContent", {
        get: function () { return this.childNodes.map(function (n) { return n.textContent; }).join(""); },
        set: function (v) { this.childNodes = []; if (v !== "" && v != null) this.appendChild(new DOM.Text(String(v))); DOM.touch(); }
    });
    Object.defineProperty(P, "innerText", {
        get: function () { return this.textContent; },
        set: function (v) { this.textContent = v; }
    });
    Object.defineProperty(P, "innerHTML", {
        get: function () { return this.childNodes.map(DOM.serialize).join(""); },
        set: function (v) {
            this.childNodes.forEach(function (n) { n.parentNode = null; });
            this.childNodes = [];
            DOM.parse(String(v == null ? "" : v), this);
            DOM.touch();
        }
    });
    Object.defineProperty(P, "outerHTML", { get: function () { return DOM.serialize(this); } });
    ["offsetWidth", "clientWidth", "scrollWidth"].forEach(function (k) {
        Object.defineProperty(P, k, { get: function () { return GAME_box(this).w; } });
    });
    ["offsetHeight", "clientHeight", "scrollHeight"].forEach(function (k) {
        Object.defineProperty(P, k, { get: function () { return GAME_box(this).h; } });
    });
    Object.defineProperty(P, "offsetLeft", { get: function () { return GAME_box(this).x; } });
    Object.defineProperty(P, "offsetTop", { get: function () { return GAME_box(this).y; } });
    Object.defineProperty(P, "ownerDocument", { get: function () { return document; } });
})(DOM.Element.prototype);

DOM.Fragment = function () { DOM.Element.call(this, "#fragment"); this.nodeType = 11; };
DOM.Fragment.prototype = Object.create(DOM.Element.prototype);

// ------------------------------------------------------------ html parsing

DOM.VOID = { br: 1, img: 1, hr: 1, input: 1, meta: 1, link: 1, wbr: 1 };
DOM.ENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "...", times: "x", copy: "(c)", laquo: "«", raquo: "»", middot: "·", bull: "•", larr: "←", rarr: "→", uarr: "↑", darr: "↓", hearts: "♥", minus: "-",
    eacute: "é", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", scaron: "š", ccaron: "č", rcaron: "ř", zcaron: "ž", deg: "°", frac12: "½", euro: "€", pound: "£", trade: "(tm)", reg: "(R)" };
DOM.entities = function (s) {
    return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, function (m, e) {
        if (e[0] == "#") return String.fromCodePoint(e[1] == "x" || e[1] == "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
        return e.toLowerCase() in DOM.ENT ? DOM.ENT[e.toLowerCase()] : m;
    });
};
DOM.CLOSES_P = { p: 1, div: 1, ul: 1, ol: 1, table: 1, pre: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, section: 1, blockquote: 1, hr: 1, dl: 1 };
DOM.SELF_CLOSE = { li: 1, p: 1, tr: 1, td: 1, th: 1, option: 1, dt: 1, dd: 1 };
DOM.parse = function (html, parent) {
    var stack = [parent], re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|[^<]+|</g, m;
    while ((m = re.exec(html))) {
        var top = stack[stack.length - 1], s = m[0];
        if (s.startsWith("<!--")) continue;
        if (m[1]) {
            var tag = m[1].toLowerCase();
            if (s[1] == "/") {
                for (var i = stack.length - 1; i > 0; i--) if (stack[i].tagName.toLowerCase() == tag) { stack.length = i; break; }
                continue;
            }
            // as in a browser, a block closes an open <p>, an <li> the open <li>
            var open = stack[stack.length - 1].tagName && stack[stack.length - 1].tagName.toLowerCase();
            if (stack.length > 1 && ((open == "p" && DOM.CLOSES_P[tag]) || (open == tag && DOM.SELF_CLOSE[tag]))) { stack.pop(); top = stack[stack.length - 1]; }
            var el = document.createElement(tag), ar = /([^\s=>\/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g, a;
            while ((a = ar.exec(m[2] || ""))) {
                var v = a[2] === undefined ? "" : a[2].replace(/^["']|["']$/g, "");
                el.setAttribute(a[1].toLowerCase(), DOM.entities(v));
            }
            top.appendChild(el);
            if (!m[3] && !DOM.VOID[tag]) stack.push(el);
        } else {
            top.appendChild(new DOM.Text(DOM.entities(s)));
        }
    }
};
DOM.serialize = function (n) {
    if (n.nodeType == 3) return n.data.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    var t = n.tagName.toLowerCase(), a = "";
    if (n.id) a += " id=\"" + n.id + "\"";
    if (n.className) a += " class=\"" + n.className + "\"";
    for (var k in n.attributes) if (k != "id" && k != "class") a += " " + k + "=\"" + n.attributes[k] + "\"";
    if (DOM.VOID[t]) return "<" + t + a + ">";
    return "<" + t + a + ">" + n.childNodes.map(DOM.serialize).join("") + "</" + t + ">";
};

// ------------------------------------------------------------ selectors

DOM.matches = function (el, part) {
    if (el.nodeType != 1) return false;
    var m = /^([a-zA-Z0-9*]*)((?:[#.][\w-]+)*)$/.exec(part);
    if (!m) return false;
    if (m[1] && m[1] != "*" && el.tagName.toLowerCase() != m[1].toLowerCase()) return false;
    var rest = m[2].match(/[#.][\w-]+/g) || [];
    for (var i = 0; i < rest.length; i++) {
        var r = rest[i];
        if (r[0] == "#" && el.id != r.slice(1)) return false;
        if (r[0] == "." && !el.classList.contains(r.slice(1))) return false;
    }
    return true;
};
// descendants of root matching a selector; as in a browser, the parts before
// the last may match any ancestor, root and above included. Parts are joined
// by a space (any ancestor) or ">" (the parent)
DOM.query = function (root, sel, first) {
    var out = [];
    var groups = sel.split(",").map(function (one) {
        return one.replace(/\s*>\s*/g, " > ").trim().split(/\s+/);
    });
    // does el match parts[0..i], parts[i] being el's own part?
    var fits = function (el, parts, i) {
        if (i === undefined) i = parts.length - 1;
        if (!el || !DOM.matches(el, parts[i])) return false;
        if (i == 0) return true;
        if (parts[i - 1] == ">") return fits(el.parentNode, parts, i - 2);
        for (var a = el.parentNode; a; a = a.parentNode) if (fits(a, parts, i - 1)) return true;
        return false;
    };
    var walk = function (n) {
        for (var i = 0; i < n.childNodes.length; i++) {
            var c = n.childNodes[i];
            if (c.nodeType != 1) continue;
            for (var g = 0; g < groups.length; g++) if (fits(c, groups[g])) { out.push(c); break; }
            if (first && out.length) return;
            walk(c);
            if (first && out.length) return;
        }
    };
    walk(root);
    if (first) return out[0] || null;
    out.item = function (i) { return this[i]; };
    return out;
};

// ------------------------------------------------------------ canvas

// A rot.js display draws into a canvas; here the canvas is a grid of cells
// (rotty's patch of the display backends writes into it directly).
DOM.Canvas = function () {
    DOM.Element.call(this, "canvas");
    this.cols = 0; this.rows = 0;
    this.ch = []; this.fg = []; this.bg = [];
    this.cursor = null;
    this.ops = [];   // what was drawn with fillText and strokeRect, in pixels
    this._ctx = null;
    this._w = 0; this._h = 0;
};
DOM.Canvas.prototype = Object.create(DOM.Element.prototype);
// setting the size clears a canvas, as in a browser
Object.defineProperty(DOM.Canvas.prototype, "width", { get: function () { return this._w; }, set: function (v) { this._w = v | 0; this.ops = []; DOM.touch(); } });
Object.defineProperty(DOM.Canvas.prototype, "height", { get: function () { return this._h; }, set: function (v) { this._h = v | 0; this.ops = []; DOM.touch(); } });
DOM.Canvas.prototype.resizeCells = function (cols, rows, bg) {
    this.cols = cols; this.rows = rows;
    this._w = cols; this._h = rows;
    var n = cols * rows;
    this.ch = new Array(n).fill(" ");
    this.fg = new Array(n).fill(null);
    this.bg = new Array(n).fill(bg || null);
    DOM.touch();
};
DOM.Canvas.prototype.put = function (x, y, ch, fg, bg) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    var i = y * this.cols + x;
    this.ch[i] = ch == null || ch === "" ? " " : String(ch);
    this.fg[i] = fg; this.bg[i] = bg;
    DOM.touch();
};
DOM.Canvas.prototype.fill = function (bg) {
    for (var i = 0; i < this.ch.length; i++) { this.ch[i] = " "; this.bg[i] = bg; this.fg[i] = null; }
    DOM.touch();
};
DOM.Canvas.prototype.getContext = function () {
    if (this._ctx) return this._ctx;
    var canvas = this;
    this._ctx = {
        canvas: canvas,
        font: "15px monospace", fillStyle: "#000", strokeStyle: "#000",
        textAlign: "center", textBaseline: "middle", globalAlpha: 1, lineWidth: 1,
        measureText: function (t) { return { width: String(t).length * 100 / 100 * (parseFloat(this.font) || 15) * 0.6 }; },
        fillRect: function (x, y, w, h) {
            if (x <= 0 && y <= 0 && w >= canvas._w && h >= canvas._h) { canvas.fill(this.fillStyle); canvas.ops = []; }
            else canvas.ops.push({ op: "fillRect", x: x, y: y, w: w, h: h, color: this.fillStyle, alpha: this.globalAlpha });
        },
        clearRect: function (x, y, w, h) {
            if (x <= 0 && y <= 0 && w >= canvas._w && h >= canvas._h) { canvas.fill(null); canvas.ops = []; }
        },
        // a game that draws text on a canvas of its own: the calls are kept
        // for its layout to place in cells
        fillText: function (t, x, y) {
            if (canvas.ops.length > 20000) canvas.ops.splice(0, 10000);
            canvas.ops.push({ op: "fillText", text: String(t), x: x, y: y, color: this.fillStyle, font: this.font, alpha: this.globalAlpha });
            DOM.touch();
        },
        strokeRect: function (x, y, w, h) {
            canvas.ops.push({ op: "strokeRect", x: x, y: y, w: w, h: h, color: this.strokeStyle, alpha: this.globalAlpha });
            DOM.touch();
        },
        strokeText: function () {}, drawImage: function () {},
        beginPath: function () {}, closePath: function () {}, moveTo: function () {}, lineTo: function () {},
        arc: function () {}, fill: function () {}, stroke: function () {}, rect: function () {},
        save: function () {}, restore: function () {}, translate: function () {}, scale: function () {},
        rotate: function () {}, setTransform: function () {}, clip: function () {},
        getImageData: function (x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
        putImageData: function () {}, createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
    };
    return this._ctx;
};
DOM.Canvas.prototype.toDataURL = function () { return ""; };

// ------------------------------------------------------------ document, window

var document = new DOM.Element("#document");
document.nodeType = 9;
document.documentElement = new DOM.Element("html");
document.head = new DOM.Element("head");
document.body = new DOM.Element("body");
document.documentElement.appendChild(document.head);
document.documentElement.appendChild(document.body);
document.childNodes = [document.documentElement];
document.readyState = "loading";
document.title = "";
document.hidden = false;
document.visibilityState = "visible";
document.cookie = "";
document.fonts = { ready: { then: function (f) { setTimeout(f, 0); return this; } }, load: function () { return { then: function (f) { setTimeout(f, 0); } }; } };
document.createElement = function (tag) {
    return String(tag).toLowerCase() == "canvas" ? new DOM.Canvas() : new DOM.Element(tag);
};
document.createElementNS = function (ns, tag) { return document.createElement(tag); };
document.createTextNode = function (t) { return new DOM.Text(String(t)); };
document.createDocumentFragment = function () { return new DOM.Fragment(); };
document.getElementById = function (id) { return DOM.query(document, "#" + id, true); };
document.createEvent = function () { return new DOM.Event(""); };
document.hasFocus = function () { return true; };
document.activeElement = document.body;
document.location = { href: "file:///index.html", search: "", hash: "", pathname: "/index.html", reload: function () { MAIN.reload(); } };

var navigator = { userAgent: "rotty (terminal)", language: "en", languages: ["en"], platform: "terminal", vendor: "", maxTouchPoints: 0, vibrate: function () { return false; } };

var localStorage = (function () {
    var data = {};
    var api = {
        _data: data,
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); MAIN.saveSoon(); },
        removeItem: function (k) { delete data[k]; MAIN.saveSoon(); },
        clear: function () { for (var k in data) delete data[k]; MAIN.saveSoon(); },
        key: function (i) { return Object.keys(data)[i] || null; }
    };
    Object.defineProperty(api, "length", { get: function () { return Object.keys(data).length; } });
    return api;
})();

var XMLHttpRequest = function () {
    this.readyState = 0; this.status = 0; this.responseText = ""; this.response = null;
    this.responseType = ""; this._url = null;
    DOM.listen(this);
};
XMLHttpRequest.prototype.open = function (method, url) { this._url = String(url).replace(/^\.\//, "").replace(/\?.*$/, ""); this.readyState = 1; };
XMLHttpRequest.prototype.setRequestHeader = function () {};
XMLHttpRequest.prototype.overrideMimeType = function () {};
XMLHttpRequest.prototype.abort = function () {};
XMLHttpRequest.prototype.getResponseHeader = function () { return null; };
XMLHttpRequest.prototype.getAllResponseHeaders = function () { return ""; };
XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    setTimeout(function () {
        var f = GAME.files[xhr._url];
        xhr.readyState = 4;
        xhr.status = f == null ? 404 : 200;
        xhr.responseText = f == null ? "" : f;
        xhr.response = xhr.responseType == "json" && f != null ? JSON.parse(f) : xhr.responseText;
        if (f == null) AV.write("xhr: no file " + xhr._url);
        xhr.dispatchEvent(new DOM.Event("readystatechange"));
        xhr.dispatchEvent(new DOM.Event(f == null ? "error" : "load"));
        xhr.dispatchEvent(new DOM.Event("loadend"));
    }, 0);
};

var Image = function () { DOM.Element.call(this, "img"); var self = this; setTimeout(function () { if (self.onload) self.onload(); }, 0); };
Image.prototype = Object.create(DOM.Element.prototype);
var Audio = function () { DOM.Element.call(this, "audio"); };
Audio.prototype = Object.create(DOM.Element.prototype);
Audio.prototype.play = function () { return { then: function () { return this; }, catch: function () { return this; } }; };
Audio.prototype.pause = function () {};
Audio.prototype.load = function () {};

function GAME_box(el) {
    var b = GAME.box ? GAME.box(el) : null;
    if (b) return b;
    if (el.nodeType == 1 && el.tagName == "CANVAS") return { x: 0, y: 0, w: el.cols, h: el.rows };
    if (el == document.body || el == document.documentElement) return { x: 0, y: 0, w: TERM.w, h: TERM.h };
    return { x: 0, y: 0, w: 0, h: 0 };
}

DOM.setupWindow = function () {
    var g = globalThis;
    g.window = g; g.self = g; g.top = g; g.parent = g;
    g.document = document;
    g.navigator = navigator;
    g.localStorage = localStorage;
    g.sessionStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
    g.XMLHttpRequest = XMLHttpRequest;
    g.Image = Image; g.Audio = Audio;
    g.HTMLElement = DOM.Element; g.Element = DOM.Element; g.Node = DOM.Element;
    g.HTMLCanvasElement = DOM.Canvas;
    g.Event = DOM.Event;
    g.CustomEvent = function (t, o) { DOM.Event.call(this, t, o || {}); this.detail = o && o.detail; };
    g.CustomEvent.prototype = Object.create(DOM.Event.prototype);
    g.KeyboardEvent = DOM.Event;
    g.location = document.location;
    g.history = { pushState: function () {}, replaceState: function () {}, back: function () {} };
    g.screen = {};
    g.devicePixelRatio = 1;
    g.setTimeout = AV_timers.setTimeout;
    g.setInterval = AV_timers.setInterval;
    g.clearTimeout = AV_timers.clear;
    g.clearInterval = AV_timers.clear;
    g.requestAnimationFrame = function (f) { return AV_timers.setTimeout(function () { f(Date.now()); }, 16); };
    g.cancelAnimationFrame = AV_timers.clear;
    g.console = AV_console;
    g.alert = function (t) { AV.write("alert: " + t); if (GAME.alert) GAME.alert(String(t)); };
    g.confirm = function () { return true; };
    g.prompt = function () { return null; };
    g.open = function () { return null; };
    g.getComputedStyle = function (el) { return el.style || {}; };
    g.matchMedia = function () { return { matches: false, addListener: function () {}, removeListener: function () {}, addEventListener: function () {} }; };
    g.performance = { now: function () { return os.now ? os.now() : Date.now(); } };
    g.scrollTo = function () {};
    g.focus = function () {};
    DOM.listen(g);
    Object.defineProperty(g, "innerWidth", { get: function () { return TERM.w; }, configurable: true });
    Object.defineProperty(g, "innerHeight", { get: function () { return TERM.h; }, configurable: true });
    Object.defineProperty(g, "outerWidth", { get: function () { return TERM.w; }, configurable: true });
    Object.defineProperty(g, "outerHeight", { get: function () { return TERM.h; }, configurable: true });
    screen.width = TERM.w; screen.height = TERM.h;
};
