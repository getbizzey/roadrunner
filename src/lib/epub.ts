// Reads an EPUB (a zip of XHTML chapters) into its title and chapters in reading order, each
// with its name from the table of contents.
import { strFromU8, unzipSync } from 'fflate';

const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');
}

const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

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

export type EpubCover = { bytes: Uint8Array; ext: string };
/** One file of the book. `title` is set when the table of contents points at it. */
export type EpubChapter = { html: string; title: string | null };
type Manifest = Map<string, { href: string; type: string; props: string }>;

export function readEpub(bytes: Uint8Array): { title: string | null; chapters: EpubChapter[]; cover: EpubCover | null } {
  const files = unzipSync(bytes);
  const text = (path: string) => (files[path] ? strFromU8(files[path]) : null);

  const container = text('META-INF/container.xml');
  const opfPath = container && attr(container.match(/<rootfile\b[^>]*>/i)?.[0] || '', 'full-path');
  const opf = opfPath && text(opfPath);
  if (!opfPath || !opf) throw new Error('Not a valid EPUB');
  const opfDir = dirOf(opfPath);

  const title = opf.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim();

  const manifest: Manifest = new Map();
  for (const tag of opf.match(/<item\b[^>]*>/gi) || []) {
    const id = attr(tag, 'id');
    const href = attr(tag, 'href');
    if (id && href) manifest.set(id, { href, type: attr(tag, 'media-type') || '', props: attr(tag, 'properties') || '' });
  }

  const toc = readToc(opf, manifest, opfDir, text);
  const chapters: EpubChapter[] = [];
  for (const tag of opf.match(/<itemref\b[^>]*>/gi) || []) {
    const idref = attr(tag, 'idref');
    const item = idref ? manifest.get(idref) : undefined;
    if (!item || !/html/i.test(item.type + item.href)) continue;
    const path = resolvePath(opfDir, item.href);
    const html = text(path);
    if (html) chapters.push({ html, title: toc.get(path) ?? null });
  }
  return { title: title ? decodeEntities(title) : null, chapters, cover: findCover(opf, manifest, opfDir, files) };
}

// Chapter names by file path, from the EPUB 3 nav document or else the EPUB 2 NCX. Where several
// entries point into one file, the first (the outermost) names it.
function readToc(opf: string, manifest: Manifest, opfDir: string, text: (path: string) => string | null) {
  const toc = new Map<string, string>();
  const add = (base: string, href: string | undefined, label: string) => {
    const title = stripTags(label);
    const path = href && resolvePath(base, href);
    if (path && title && !toc.has(path)) toc.set(path, title);
  };
  const items = [...manifest.values()];

  const nav = items.find((item) => /\bnav\b/.test(item.props));
  const navPath = nav && resolvePath(opfDir, nav.href);
  const navHtml = navPath && text(navPath);
  if (navPath && navHtml) {
    const navs = navHtml.match(/<nav\b[\s\S]*?<\/nav>/gi) || [];
    const tocNav = navs.find((n) => /epub:type\s*=\s*["'][^"']*\btoc\b/i.test(n.slice(0, n.indexOf('>')))) || navs[0] || '';
    for (const [, tag, label] of tocNav.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) add(dirOf(navPath), attr(tag, 'href'), label);
    if (toc.size) return toc;
  }

  const spineToc = attr(opf.match(/<spine\b[^>]*>/i)?.[0] || '', 'toc');
  const ncx = (spineToc && manifest.get(spineToc)) || items.find((item) => item.type === 'application/x-dtbncx+xml');
  const ncxPath = ncx && resolvePath(opfDir, ncx.href);
  const ncxXml = ncxPath && text(ncxPath);
  if (ncxPath && ncxXml) {
    // Each navPoint has its label, then its content, then any nested navPoints.
    const points = ncxXml.matchAll(/<navLabel\b[^>]*>[\s\S]*?<text\b[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/navLabel>\s*(<content\b[^>]*>)/gi);
    for (const [, label, tag] of points) add(dirOf(ncxPath), attr(tag, 'src'), label);
  }
  return toc;
}

// EPUB 3 marks the cover in the manifest, EPUB 2 in a <meta name="cover">; some books only
// have an image called "cover".
function findCover(opf: string, manifest: Manifest, opfDir: string, files: Record<string, Uint8Array>): EpubCover | null {
  const images = [...manifest.entries()].filter(([, item]) => item.type.startsWith('image/'));
  const metaTag = (opf.match(/<meta\b[^>]*>/gi) || []).find((tag) => attr(tag, 'name') === 'cover');
  const metaId = metaTag && attr(metaTag, 'content');
  const found =
    images.find(([, item]) => /\bcover-image\b/.test(item.props)) ||
    images.find(([id]) => id === metaId) ||
    images.find(([id, item]) => /cover/i.test(id + item.href));
  if (!found) return null;
  const bytes = files[resolvePath(opfDir, found[1].href)];
  const ext = found[1].type.split('/')[1]?.replace('jpeg', 'jpg').replace(/\+.*/, '') || 'jpg';
  return bytes && isImage(bytes) ? { bytes, ext } : null;
}

// JPEG, PNG, GIF or WebP. Rules out covers a DRM-protected book has encrypted.
function isImage(b: Uint8Array) {
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  return starts(0xff, 0xd8) || starts(0x89, 0x50, 0x4e, 0x47) || starts(0x47, 0x49, 0x46) || starts(0x52, 0x49, 0x46, 0x46);
}
