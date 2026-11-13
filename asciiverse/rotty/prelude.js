// rotty: rot.js games in the terminal. This is the start of the one module
// the game is built as: QuickJS's system modules, the browser's timers, and
// a console that never writes over the screen.
import * as std from "qjs:std";
import * as os from "qjs:os";

var AV = { id: "game", log: null, debug: false, errors: 0 };

AV.write = function (line) {
    if (!AV.log) return;
    try { AV.log.puts(new Date().toISOString() + " " + line + "\n"); AV.log.flush(); } catch (e) {}
};

// as in a browser, an error in a callback is logged and the game goes on
function AV_guard(f) {
    return function () {
        try { return f.apply(this, arguments); }
        catch (e) {
            AV.errors++;
            AV.write("error: " + e + "\n" + (e && e.stack || ""));
            if (!os.isatty(2)) std.err.puts(AV.id + ": " + e + "\n" + (e && e.stack || "") + "\n");
        }
    };
}

var AV_timers = {
    setTimeout: function (f, ms) {
        if (typeof f == "string") { var src = f; f = function () { std.evalScript(src); }; }
        var args = Array.prototype.slice.call(arguments, 2);
        return os.setTimeout(AV_guard(function () { f.apply(null, args); }), ms || 0);
    },
    setInterval: function (f, ms) {
        var args = Array.prototype.slice.call(arguments, 2);
        var box = { live: true, handle: null };
        var g = AV_guard(function () { f.apply(null, args); });
        var tick = function () {
            if (!box.live) return;
            box.handle = os.setTimeout(tick, Math.max(ms || 0, 4));
            g();
        };
        box.handle = os.setTimeout(tick, Math.max(ms || 0, 4));
        return box;
    },
    clear: function (h) {
        if (!h) return;
        if (typeof h == "object" && "live" in h) { h.live = false; if (h.handle) os.clearTimeout(h.handle); return; }
        os.clearTimeout(h);
    }
};

var AV_console = (function () {
    var log = function () { AV.write("console: " + Array.prototype.join.call(arguments, " ")); };
    return { log: log, info: log, warn: log, error: log, debug: log, trace: log, time: function () {}, timeEnd: function () {} };
})();
