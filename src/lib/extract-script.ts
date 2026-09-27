// Page-side code that turns HTML or PDF into plain text, using DOMParser and pdf.js exactly
// like the web app. It runs inside a hidden WebView on iOS/Android and is injected into the
// page on web. Kept as a plain string: release builds compile JS to Hermes bytecode, so
// functions can't be serialised with toString().
//
// Protocol: window.__extract({ id, kind: 'pdf' | 'html' | 'book', data }) — data is base64 for PDFs
// and a JSON array of chapter XHTML strings for books (whose text is a JSON array of chapter texts).
// Replies go through window.__extractSend({ id, text } | { id, error } | { id, progress }).

export const EXTRACTOR_SOURCE = `
(function () {
  var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
  var PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

  function htmlToText(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, noscript, nav, header, footer, aside').forEach(function (n) { n.remove(); });
    // A parsed document isn't rendered, so innerText adds no line breaks: add them after blocks.
    // Blocks get a blank line, which the reader pauses on as a paragraph end; a line break doesn't.
    doc.querySelectorAll('br').forEach(function (n) { n.append('\\n'); });
    doc.querySelectorAll('p, div, li, dt, dd, h1, h2, h3, h4, h5, h6, blockquote, pre, section, article, tr, figcaption')
      .forEach(function (n) { n.append('\\n\\n'); });
    var root = doc.querySelector('article, main') || doc.body;
    return (root && root.textContent) || '';
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function pdfToText(bytes, onProgress) {
    var pdfjs = await import(PDFJS_URL);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    var doc = await pdfjs.getDocument({ data: bytes }).promise;
    var pages = [];
    for (var p = 1; p <= doc.numPages; p++) {
      var content = await (await doc.getPage(p)).getTextContent();
      var line = '';
      var prev = null;
      for (var item of content.items) {
        if (!item.str) continue;
        if (prev) {
          // Only add a space where the text runs are actually apart on the page.
          var gap = item.transform[4] - (prev.transform[4] + prev.width);
          var em = item.height || prev.height || 10;
          if (prev.hasEOL || item.transform[5] !== prev.transform[5]) line += '\\n';
          else if (gap > em * 0.12) line += ' ';
        }
        line += item.str;
        prev = item;
      }
      pages.push(line);
      if (p % 10 === 0) onProgress('Reading PDF… page ' + p + ' of ' + doc.numPages);
    }
    // Rejoin words hyphenated across line breaks.
    return pages.join('\\n').replace(/(\\p{L})-\\n(\\p{L})/gu, '$1$2');
  }

  window.__extract = async function (req) {
    var send = window.__extractSend;
    try {
      var text;
      if (req.kind === 'pdf') {
        text = await pdfToText(base64ToBytes(req.data), function (progress) { send({ id: req.id, progress: progress }); });
      } else if (req.kind === 'book') {
        // An EPUB's chapters, in reading order, as a JSON array of XHTML strings. Answers with a
        // JSON array of their texts, so the caller knows where each chapter starts.
        text = JSON.stringify(JSON.parse(req.data).map(function (html) { return htmlToText(html).trim(); }));
      } else {
        text = htmlToText(req.data);
      }
      send({ id: req.id, text: text });
    } catch (e) {
      send({ id: req.id, error: String((e && e.message) || e) });
    }
  };
})();
`;

export const EXTRACTOR_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
window.__extractSend = function (msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };
${EXTRACTOR_SOURCE}
</script></body></html>`;
