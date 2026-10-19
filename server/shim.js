/*
 * Minimal browser environment for the PlantUML engine (`@plantuml/core`) in the YouTrack script
 * runtime (GraalVM JS: no DOM, no timers, no WebAssembly). The build puts this code in front of
 * the engine in `plantuml-engine.js`.
 *
 * - DOM: only what the engine's SVG writer uses (createElementNS, setAttribute, appendChild, ...).
 * - Timers: TeaVM threads continue in setTimeout callbacks. `drainTimers()` runs them all
 *   synchronously, so one render completes inside one HTTP handler call.
 * - Text measure: Helvetica/Arial advance widths instead of canvas. ponytail: fixed metrics; the
 *   layout is slightly off for other fonts. Bundle real font metrics if it matters.
 * - Layout: without `Viz` (Graphviz, needs WebAssembly) the engine falls back to Smetana.
 */
(function () {
var g = globalThis;
g.window = g;
g.self = g;
if (typeof g.console === 'undefined') {
  g.console = {log: function () {}, info: function () {}, warn: function () {}, error: function () {}};
}

var timers = [];
var timerSeq = 0;
g.setTimeout = function (fn, delay) {
  timers.push({id: ++timerSeq, at: delay || 0, seq: timerSeq, fn: fn});
  return timerSeq;
};
g.clearTimeout = function (id) {
  timers = timers.filter(function (t) { return t.id !== id; });
};
// The engine schedules only short delays; run in delay order, then in schedule order.
function drainTimers(limit) {
  var steps = 0;
  while (timers.length > 0) {
    if (++steps > limit) {
      throw new Error('PlantUML render did not finish');
    }
    timers.sort(function (a, b) { return a.at - b.at || a.seq - b.seq; });
    var t = timers.shift();
    t.fn();
  }
}

// Helvetica advance widths for ASCII 32..126, per 1000 units of font size.
var HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];

function textWidth(text, font, size) {
  var mono = /mono|courier|consol/i.test(font);
  var bold = /bold|[6-9]00/i.test(font);
  var units = 0;
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if (mono) {
      units += 600;
    } else if (c >= 32 && c <= 126) {
      units += HELVETICA[c - 32];
    } else {
      units += c >= 0x2E80 ? 1000 : 556;
    }
  }
  return units * size / 1000 * (bold && !mono ? 1.05 : 1);
}

function fontSize(font) {
  var m = /(\d+(?:\.\d+)?)px/.exec(font);
  return m ? Number(m[1]) : 10;
}

function Node(name, ns) {
  this.tagName = name;
  this.nodeName = name;
  this.namespaceURI = ns || null;
  this.attrs = [];
  this.children = [];
  this.style = {};
  this.ownerDocument = g.document;
}
Object.defineProperty(Node.prototype, 'firstChild', {
  get: function () { return this.children[0] || null; }
});
Object.defineProperty(Node.prototype, 'textContent', {
  get: function () {
    return this.children.map(function (c) { return c.text !== undefined ? c.text : c.textContent; }).join('');
  },
  set: function (value) {
    this.children = [{text: String(value)}];
  }
});
Node.prototype.setAttribute = function (name, value) {
  for (var i = 0; i < this.attrs.length; i++) {
    if (this.attrs[i][0] === name) {
      this.attrs[i][1] = String(value);
      return;
    }
  }
  this.attrs.push([name, String(value)]);
};
Node.prototype.setAttributeNS = function (ns, name, value) {
  this.setAttribute(name, value);
};
Node.prototype.getAttribute = function (name) {
  for (var i = 0; i < this.attrs.length; i++) {
    if (this.attrs[i][0] === name) {
      return this.attrs[i][1];
    }
  }
  return null;
};
Node.prototype.appendChild = function (child) {
  this.children.push(child);
  return child;
};
Node.prototype.removeChild = function (child) {
  this.children = this.children.filter(function (c) { return c !== child; });
  return child;
};
Node.prototype.getBBox = function () {
  var size = Number(this.getAttribute('font-size')) || 10;
  return {x: 0, y: -size * 0.905, width: textWidth(this.textContent, this.getAttribute('font-family') || '', size), height: size * 1.117};
};
// Sprites (C4 icons) are drawn into a canvas and embedded as a PNG data URL.
Node.prototype.toDataURL = function () {
  return 'data:image/png;base64,' + base64(encodePng(this.width, this.height, this.pixels || new Uint8Array(this.width * this.height * 4)));
};
Node.prototype.getContext = function () {
  var canvas = this;
  return {
    createImageData: function (w, h) { return {width: w, height: h, data: new Uint8Array(w * h * 4)}; },
    putImageData: function (image) { canvas.pixels = image.data; },
    font: '10px sans-serif',
    measureText: function (text) {
      var size = fontSize(this.font);
      return {
        width: textWidth(String(text), this.font, size),
        actualBoundingBoxAscent: size * 0.716,
        actualBoundingBoxDescent: size * 0.21,
        fontBoundingBoxAscent: size * 0.905,
        fontBoundingBoxDescent: size * 0.212
      };
    }
  };
};

g.document = {
  createElementNS: function (ns, name) { return new Node(name, ns); },
  createElement: function (name) { return new Node(name); },
  createProcessingInstruction: function (target, data) { return {pi: target + ' ' + data}; },
  getElementById: function () { return null; }
};
g.document.body = new Node('body');
g.document.head = new Node('head');

var CRC_TABLE = [];
for (var n = 0; n < 256; n++) {
  var c = n;
  for (var k = 0; k < 8; k++) {
    c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}
function crc32(bytes) {
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function u32(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}
function chunk(type, data) {
  var body = [];
  for (var i = 0; i < 4; i++) {
    body.push(type.charCodeAt(i));
  }
  for (var j = 0; j < data.length; j++) {
    body.push(data[j]);
  }
  return u32(data.length).concat(body, u32(crc32(body)));
}
/** RGBA PNG with uncompressed (stored) deflate blocks. ponytail: no compression, sprites are tiny. */
function encodePng(w, h, rgba) {
  var raw = [];
  for (var y = 0; y < h; y++) {
    raw.push(0);
    for (var x = 0; x < w * 4; x++) {
      raw.push(rgba[y * w * 4 + x]);
    }
  }
  var z = [0x78, 0x01];
  for (var p = 0; p < raw.length || p === 0; p += 65535) {
    var len = Math.min(65535, raw.length - p);
    z.push(p + len >= raw.length ? 1 : 0, len & 255, len >>> 8, ~len & 255, (~len >>> 8) & 255);
    for (var q = 0; q < len; q++) {
      z.push(raw[p + q]);
    }
  }
  var a = 1, b = 0;
  for (var r = 0; r < raw.length; r++) {
    a = (a + raw[r]) % 65521;
    b = (b + a) % 65521;
  }
  z = z.concat(u32(((b << 16) | a) >>> 0));
  return [137, 80, 78, 71, 13, 10, 26, 10].concat(
    chunk('IHDR', u32(w).concat(u32(h), [8, 6, 0, 0, 0])),
    chunk('IDAT', z),
    chunk('IEND', [])
  );
}
var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[n >> 18] + B64[(n >> 12) & 63] +
      (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function serialize(node) {
  if (node.text !== undefined) {
    return escapeText(node.text);
  }
  if (node.pi !== undefined) {
    return '<?' + node.pi + '?>';
  }
  var out = '<' + node.tagName;
  for (var i = 0; i < node.attrs.length; i++) {
    out += ' ' + node.attrs[i][0] + '="' + escapeText(node.attrs[i][1]).replace(/"/g, '&quot;') + '"';
  }
  if (node.children.length === 0) {
    return out + '/>';
  }
  return out + '>' + node.children.map(serialize).join('') + '</' + node.tagName + '>';
}
g.XMLSerializer = function () {};
g.XMLSerializer.prototype.serializeToString = serialize;

// Stdlib bundles (C4) are evaluated in front of the engine, so the loader has nothing to fetch.
g.PLANTUML_STDLIB_LOADER = function (file, ok, fail) {
  var lib = file.replace(/\.min\.js$/, '');
  if (g.PLANTUML_STDLIB_INFO && g.PLANTUML_STDLIB_INFO[lib]) {
    ok();
  } else {
    fail('Only the bundled C4 library is available: ' + file);
  }
};

// The only name the engine wrapper uses; everything else stays out of the engine scope.
g.__plantumlDrainTimers = drainTimers;
})();
