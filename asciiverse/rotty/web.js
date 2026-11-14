// rotty: the newer parts of the browser, for games written against today's
// DOM rather than rot.js's display: custom elements and shadow roots, the
// style object's setProperty, templates, dialogs, text inputs, tables,
// element.animate, AbortController and URL.

// ------------------------------------------------------------ style

DOM.camel = function (k) { return k.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); }); };
DOM.Style = function () {};
Object.defineProperties(DOM.Style.prototype, {
    setProperty: { value: function (k, v) { k = String(k); this[k.startsWith("--") ? k : DOM.camel(k)] = v == null ? "" : String(v); DOM.touch(); } },
    getPropertyValue: { value: function (k) { k = String(k); var v = this[k.startsWith("--") ? k : DOM.camel(k)]; return v == null ? "" : String(v); } },
    removeProperty: { value: function (k) { k = String(k); var key = k.startsWith("--") ? k : DOM.camel(k), v = this[key]; delete this[key]; DOM.touch(); return v || ""; } },
    cssText: {
        get: function () { var out = []; for (var k in this) out.push(k + ": " + this[k]); return out.join("; "); },
        set: function (v) { for (var k in this) delete this[k]; DOM.parseStyle(v, this); }
    }
});

// ------------------------------------------------------------ elements

(function (P) {
    var nodes = function (args) {
        return Array.prototype.map.call(args, function (n) { return typeof n == "object" && n ? n : new DOM.Text(String(n)); });
    };
    P.append = function () { var self = this; nodes(arguments).forEach(function (n) { self.appendChild(n); }); };
    P.prepend = function () { var self = this, first = this.firstChild; nodes(arguments).forEach(function (n) { self.insertBefore(n, first); }); };
    P.replaceChildren = function () {
        this.childNodes.slice().forEach(function (n) { n.parentNode = null; });
        this.childNodes = [];
        this.append.apply(this, arguments);
        DOM.touch();
    };
    P.before = function () { var p = this.parentNode, self = this; if (p) nodes(arguments).forEach(function (n) { p.insertBefore(n, self); }); };
    P.after = function () { var p = this.parentNode, next = this.nextSibling; if (p) nodes(arguments).forEach(function (n) { p.insertBefore(n, next); }); };
    P.closest = function (sel) { for (var n = this; n && n.nodeType == 1; n = n.parentNode) if (DOM.matches(n, sel)) return n; return null; };
    P.matches = function (sel) { return DOM.matches(this, sel); };
    P.toggleAttribute = function (k, force) {
        var on = force === undefined ? !this.hasAttribute(k) : !!force;
        if (on) this.setAttribute(k, ""); else this.removeAttribute(k);
        return on;
    };
    P.attachShadow = function () { this.shadowRoot = new DOM.Fragment(); this.shadowRoot.host = this; return this.shadowRoot; };
    P.insertAdjacentHTML = function (where, html) {
        var tmp = document.createElement("div");
        tmp.innerHTML = html;
        var kids = tmp.childNodes.slice(), self = this;
        if (where == "beforeend") kids.forEach(function (n) { self.appendChild(n); });
        else if (where == "afterbegin") { var f = this.firstChild; kids.forEach(function (n) { self.insertBefore(n, f); }); }
        else if (where == "beforebegin") this.before.apply(this, kids);
        else if (where == "afterend") this.after.apply(this, kids);
    };
    // a deep copy, nodes and all (a template's content keeps its text)
    P.cloneNode = function (deep) {
        var c = this.nodeType == 11 ? new DOM.Fragment() : document.createElement(this.tagName);
        c.className = this.className; c.id = this.id;
        for (var a in this.attributes) c.setAttribute(a, this.attributes[a]);
        for (var s in this.style) c.style[s] = this.style[s];
        if (this.content) c.content = this.content.cloneNode(true);
        if (deep) this.childNodes.forEach(function (n) { c.appendChild(n.cloneNode(true)); });
        return c;
    };
    Object.defineProperty(P, "hidden", {
        get: function () { return this.hasAttribute("hidden"); },
        set: function (v) { this.toggleAttribute("hidden", !!v); }
    });
    Object.defineProperty(P, "isConnected", {
        get: function () { for (var n = this; n; n = n.parentNode || n.host) if (n == document) return true; return false; }
    });
    // tables, without a tbody
    P.insertRow = function () { var r = document.createElement("tr"); this.appendChild(r); return r; };
    P.insertCell = function () { var c = document.createElement("td"); this.appendChild(c); return c; };
    // a table's rows; a canvas (and anything else) may keep its own "rows"
    Object.defineProperty(P, "rows", {
        get: function () { return DOM.query(this, "tr", false); },
        set: function (v) { Object.defineProperty(this, "rows", { value: v, writable: true, configurable: true, enumerable: true }); }
    });
    Object.defineProperty(P, "tBodies", { get: function () {
        var b = this.children.filter(function (c) { return c.tagName == "TBODY"; });
        if (!b.length && this.tagName == "TABLE") { var t = document.createElement("tbody"); this.appendChild(t); b = [t]; }
        return b;
    } });
    Object.defineProperty(P, "cells", { get: function () { return this.children.filter(function (c) { return c.tagName == "TD" || c.tagName == "TH"; }); } });
    // dialogs
    P.showModal = P.show = function () { this.setAttribute("open", ""); DOM.touch(); };
    P.close = function () { if (this.hasAttribute("open")) { this.removeAttribute("open"); this.dispatchEvent(new DOM.Event("close")); } DOM.touch(); };
    Object.defineProperty(P, "open", { get: function () { return this.hasAttribute("open"); }, set: function (v) { this.toggleAttribute("open", !!v); } });
    // text inputs
    Object.defineProperty(P, "value", {
        get: function () { return this._value !== undefined ? this._value : (this.getAttribute("value") || ""); },
        set: function (v) { this._value = String(v); DOM.touch(); }
    });
    P.focus = function () { document.activeElement = this; DOM.touch(); };
    P.blur = function () { if (document.activeElement == this) document.activeElement = document.body; DOM.touch(); };
    P.select = function () { this._selected = true; DOM.touch(); };
    // element.animate: the keyframes are not played; the animation ends
    // after its duration, and commitStyles keeps the last frame
    P.animate = function (frames, options) {
        var el = this, ms = typeof options == "number" ? options : (options && options.duration) || 0;
        var last = Array.isArray(frames) ? frames[frames.length - 1] : frames;
        var anim = { playState: "running", onfinish: null, effect: null };
        var done, timer;
        anim.finished = new Promise(function (r) { done = r; });
        anim.commitStyles = function () {
            if (last && typeof last == "object") for (var k in last) if (k != "offset" && k != "easing" && k != "composite" && !Array.isArray(last[k])) el.style.setProperty(k, last[k]);
        };
        anim.cancel = function () { if (timer) clearTimeout(timer); anim.playState = "idle"; };
        anim.finish = function () { if (timer) clearTimeout(timer); anim.playState = "finished"; done(anim); };
        anim.play = anim.pause = anim.reverse = function () {};
        timer = setTimeout(function () { anim.playState = "finished"; if (anim.onfinish) anim.onfinish(); done(anim); DOM.touch(); }, ms);
        return anim;
    };
    P.getAnimations = function () { return []; };
})(DOM.Element.prototype);

DOM.Text.prototype.cloneNode = function () { return new DOM.Text(this.data); };
DOM.Text.prototype.before = function () { DOM.Element.prototype.before.apply(this, arguments); };
DOM.Text.prototype.after = function () { DOM.Element.prototype.after.apply(this, arguments); };

// custom elements: connectedCallback when one joins the document
DOM.connected = function (n) {
    if (n.nodeType != 1 && n.nodeType != 11) return;
    if (n.connectedCallback && !n._rottyConnected) { n._rottyConnected = true; AV_guard(function () { n.connectedCallback(); })(); }
    n.childNodes.forEach(DOM.connected);
};
(function (P) {
    var append = P.appendChild, insert = P.insertBefore;
    P.appendChild = function (n) { var r = append.call(this, n); if (this.isConnected) DOM.connected(n); return r; };
    P.insertBefore = function (n, ref) { var r = insert.call(this, n, ref); if (this.isConnected) DOM.connected(n); return r; };
})(DOM.Element.prototype);

DOM.customElements = {
    registry: {},
    define: function (name, cls) {
        cls.__rottyTag = name;
        this.registry[name.toLowerCase()] = cls;
        if (GAME.defineElement) GAME.defineElement(name, cls);
    },
    get: function (name) { return this.registry[name.toLowerCase()]; },
    whenDefined: function () { return Promise.resolve(); }
};
DOM.createElementPlain = document.createElement;
document.createElement = function (tag) {
    var cls = DOM.customElements.registry[String(tag).toLowerCase()];
    if (cls) return new cls();
    return DOM.createElementPlain(tag);
};

// typing into a focused <input>: the browser's default action for a key
DOM.typeInto = function (target, key, charCode) {
    if (!target || (target.tagName != "INPUT" && target.tagName != "TEXTAREA")) return;
    var v = target.value;
    if (key.keyCode == 8) v = target._selected ? "" : v.slice(0, -1);
    else if (charCode && charCode >= 32) v = target._selected ? String.fromCodePoint(charCode) : v + String.fromCodePoint(charCode);
    else return;
    target._selected = false;
    target.value = v;
    target.dispatchEvent(new DOM.Event("input", { target: target }));
};

DOM.Event.prototype.composedPath = function () {
    var path = [];
    for (var n = this.target; n; n = n.parentNode || n.host) path.push(n);
    if (path.indexOf(window) < 0) path.push(window);
    return path;
};

// ------------------------------------------------------------ AbortController, URL

DOM.AbortController = function () {
    var signal = { aborted: false, reason: undefined, onabort: null };
    DOM.listen(signal);
    signal.throwIfAborted = function () { if (signal.aborted) throw signal.reason; };
    this.signal = signal;
    this.abort = function (reason) {
        if (signal.aborted) return;
        signal.aborted = true;
        signal.reason = reason === undefined ? new Error("AbortError") : reason;
        signal.dispatchEvent(new DOM.Event("abort"));
    };
};

DOM.URLSearchParams = function (q) {
    var list = [];
    String(q || "").replace(/^\?/, "").split("&").forEach(function (part) {
        if (!part) return;
        var i = part.indexOf("="), k = i < 0 ? part : part.slice(0, i), v = i < 0 ? "" : part.slice(i + 1);
        list.push([decodeURIComponent(k.replace(/\+/g, " ")), decodeURIComponent(v.replace(/\+/g, " "))]);
    });
    this._list = list;
};
DOM.URLSearchParams.prototype = {
    has: function (k) { return this._list.some(function (p) { return p[0] == k; }); },
    get: function (k) { var p = this._list.find(function (p) { return p[0] == k; }); return p ? p[1] : null; },
    getAll: function (k) { return this._list.filter(function (p) { return p[0] == k; }).map(function (p) { return p[1]; }); },
    set: function (k, v) { this.delete(k); this._list.push([k, String(v)]); },
    append: function (k, v) { this._list.push([k, String(v)]); },
    delete: function (k) { this._list = this._list.filter(function (p) { return p[0] != k; }); },
    toString: function () { return this._list.map(function (p) { return encodeURIComponent(p[0]) + "=" + encodeURIComponent(p[1]); }).join("&"); }
};
DOM.URL = function (href, base) {
    var s = String(href);
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && base) s = String(base).replace(/[?#].*$/, "").replace(/[^\/]*$/, "") + s;
    var m = /^([a-z][a-z0-9+.-]*:)(\/\/([^\/?#]*))?([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(s) || [];
    this.protocol = m[1] || ""; this.host = this.hostname = m[3] || ""; this.port = "";
    this.pathname = m[4] || "/"; this.search = m[5] || ""; this.hash = m[6] || "";
    this.origin = this.protocol + "//" + this.host;
    this.href = s;
    this.searchParams = new DOM.URLSearchParams(this.search);
};
DOM.URL.prototype.toString = function () { return this.href; };

// fetch: the game's own files (GAME.files), else an empty answer
DOM.fetch = function (url) {
    var path = String(url).replace(/^\.\//, "").replace(/\?.*$/, "");
    var f = GAME.files ? GAME.files[path] : null;
    var res = {
        ok: f != null, status: f != null ? 200 : 404, url: path,
        text: function () { return Promise.resolve(f || ""); },
        json: function () { return Promise.resolve(JSON.parse(f || "null")); },
        arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(0)); },
        blob: function () { return Promise.resolve({ size: 0 }); }
    };
    return Promise.resolve(res);
};

// Web Audio, silent: nodes connect and start, nothing is heard
DOM.AudioContext = function () {
    var node = function () {
        var n = { connect: function (x) { return x; }, disconnect: function () {}, start: function () {}, stop: function () {},
            setPosition: function () {}, setOrientation: function () {}, addEventListener: function () {} };
        ["gain", "frequency", "detune", "playbackRate", "positionX", "positionY", "positionZ", "pan"].forEach(function (k) {
            n[k] = { value: 0, setValueAtTime: function () {}, linearRampToValueAtTime: function () {}, exponentialRampToValueAtTime: function () {}, setTargetAtTime: function () {} };
        });
        return n;
    };
    this.state = "running"; this.currentTime = 0; this.sampleRate = 44100;
    this.destination = node(); this.listener = node();
    ["createGain", "createPanner", "createBufferSource", "createOscillator", "createStereoPanner", "createBiquadFilter", "createDynamicsCompressor", "createMediaElementSource"].forEach(function (k) { this[k] = node; }, this);
    this.createBuffer = function (c, len, rate) { return { duration: len / (rate || 44100), length: len, numberOfChannels: c, getChannelData: function () { return new Float32Array(len); } }; };
    this.decodeAudioData = function () { return Promise.resolve({ duration: 0, length: 0, numberOfChannels: 1, getChannelData: function () { return new Float32Array(0); } }); };
    this.resume = this.suspend = this.close = function () { return Promise.resolve(); };
};

DOM.setupWeb = function (g) {
    g.fetch = DOM.fetch;
    g.AudioContext = g.webkitAudioContext = DOM.AudioContext;
    if (g.Image && !g.Image.prototype.decode) g.Image.prototype.decode = function () { return Promise.resolve(); };
    g.customElements = DOM.customElements;
    g.EventTarget = function EventTarget() { DOM.listen(this); };
    g.AbortController = DOM.AbortController;
    g.URL = DOM.URL;
    g.URLSearchParams = DOM.URLSearchParams;
    g.HTMLElement = DOM.Element; g.HTMLDialogElement = DOM.Element; g.HTMLInputElement = DOM.Element;
    g.HTMLTemplateElement = DOM.Element; g.HTMLTableElement = DOM.Element; g.HTMLTableRowElement = DOM.Element;
    g.DocumentFragment = DOM.Fragment;
    g.queueMicrotask = g.queueMicrotask || function (f) { Promise.resolve().then(f); };
    g.structuredClone = g.structuredClone || function (v) { return JSON.parse(JSON.stringify(v)); };
    if (document.documentElement.style.constructor != DOM.Style) {
        [document, document.documentElement, document.head, document.body].forEach(function (n) {
            var st = new DOM.Style();
            for (var k in n.style) st[k] = n.style[k];
            n.style = st;
        });
    }
};
