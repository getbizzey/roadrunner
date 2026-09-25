// Web build: the browser already has DOMParser, so run the extractor script in the page itself.
import { useImperativeHandle, type Ref } from 'react';

import { EXTRACTOR_SOURCE } from '@/lib/extract-script';
import type { ExtractKind, Extractor } from '@/lib/files';

type Message = { id: number; text?: string; error?: string; progress?: string };
type Pending = { resolve: (text: string) => void; reject: (e: Error) => void; onProgress?: (m: string) => void };

declare global {
  interface Window {
    __extract?: (req: { id: number; kind: ExtractKind; data: string }) => void;
    __extractSend?: (msg: Message) => void;
  }
}

let nextId = 1;
const pending = new Map<number, Pending>();

function install() {
  if (window.__extract) return;
  window.__extractSend = (msg) => {
    const req = pending.get(msg.id);
    if (!req) return;
    if (msg.progress) return req.onProgress?.(msg.progress);
    pending.delete(msg.id);
    if (msg.error) req.reject(new Error(msg.error));
    else req.resolve(msg.text ?? '');
  };
  const script = document.createElement('script');
  script.textContent = EXTRACTOR_SOURCE;
  document.head.appendChild(script);
}

export default function TextExtractor({ ref }: { ref: Ref<Extractor> }) {
  useImperativeHandle(ref, () => ({
    extract(kind, data, onProgress) {
      install();
      const id = nextId++;
      return new Promise<string>((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress });
        window.__extract!({ id, kind, data });
      });
    },
  }));
  return null;
}
