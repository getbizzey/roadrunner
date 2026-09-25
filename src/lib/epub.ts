// Reads an EPUB (a zip of XHTML chapters) into its title and chapters in reading order.
import { strFromU8, unzipSync } from 'fflate';

const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Resolves an href from the package file against the package file's folder.
function resolvePath(base: string, href: string) {
  const parts = (base ? base + '/' : '').concat(decodeURIComponent(href.split('#')[0])).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}

export function readEpub(bytes: Uint8Array): { title: string | null; chapters: string[] } {
  const files = unzipSync(bytes);
  const text = (path: string) => (files[path] ? strFromU8(files[path]) : null);

  const container = text('META-INF/container.xml');
  const opfPath = container && attr(container.match(/<rootfile\b[^>]*>/i)?.[0] || '', 'full-path');
  const opf = opfPath && text(opfPath);
  if (!opfPath || !opf) throw new Error('Not a valid EPUB');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  const title = opf.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim();

  const manifest = new Map<string, { href: string; type: string }>();
  for (const tag of opf.match(/<item\b[^>]*>/gi) || []) {
    const id = attr(tag, 'id');
    const href = attr(tag, 'href');
    if (id && href) manifest.set(id, { href, type: attr(tag, 'media-type') || '' });
  }

  const chapters: string[] = [];
  for (const tag of opf.match(/<itemref\b[^>]*>/gi) || []) {
    const idref = attr(tag, 'idref');
    const item = idref ? manifest.get(idref) : undefined;
    if (!item || !/html/i.test(item.type + item.href)) continue;
    const html = text(resolvePath(opfDir, item.href));
    if (html) chapters.push(html);
  }
  return { title: title ? decodeEntities(title) : null, chapters };
}
