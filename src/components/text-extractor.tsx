// Hidden WebView that converts HTML and PDF files to plain text (see extract-script.ts).
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { EXTRACTOR_HTML } from '@/lib/extract-script';
import type { Extractor } from '@/lib/files';

type Pending = { resolve: (text: string) => void; reject: (e: Error) => void; onProgress?: (m: string) => void };

let nextId = 1;
const SOURCE = { html: EXTRACTOR_HTML };

export default function TextExtractor({ ref }: { ref: Ref<Extractor> }) {
  const webRef = useRef<WebView>(null);
  const pending = useRef(new Map<number, Pending>());
  // Requests made before the page has loaded wait on this.
  const [ready] = useState(() => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    return { promise, resolve };
  });

  useImperativeHandle(ref, () => ({
    async extract(kind, data, onProgress) {
      await ready.promise;
      const id = nextId++;
      return new Promise<string>((resolve, reject) => {
        pending.current.set(id, { resolve, reject, onProgress });
        webRef.current?.injectJavaScript(`window.__extract(${JSON.stringify({ id, kind, data })}); true;`);
      });
    },
  }));

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = JSON.parse(e.nativeEvent.data);
    const req = pending.current.get(msg.id);
    if (!req) return;
    if (msg.progress) return req.onProgress?.(msg.progress);
    pending.current.delete(msg.id);
    if (msg.error) req.reject(new Error(msg.error));
    else req.resolve(msg.text);
  };

  return (
    <View style={styles.hidden}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={SOURCE}
        onLoadEnd={ready.resolve}
        onMessage={onMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none' },
});
