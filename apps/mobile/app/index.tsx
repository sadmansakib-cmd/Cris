import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * HAULT mobile shell — hosts the web UI in a WebView and injects the
 * `window.__HAULT_MOBILE__` bridge so `native-bridge.ts` can route native
 * commands (secure storage, notifications, camera) through Expo APIs.
 */
const API_BASE =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  'https://api.hault.local';

const BRIDGE = `
  (function() {
    if (window.__HAULT_MOBILE__) return;
    const pending = new Map();
    let seq = 0;
    window.__HAULT_MOBILE__ = {
      invoke(cmd, args) {
        const id = ++seq;
        return new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          window.ReactNativeWebView.postMessage(JSON.stringify({ id, cmd, args }));
        });
      },
      __resolve(id, ok, payload) {
        const p = pending.get(id);
        if (!p) return;
        pending.delete(id);
        ok ? p.resolve(payload) : p.reject(new Error(payload));
      },
    };
    window.__HAULT_API_BASE__ = ${JSON.stringify(API_BASE)};
  })();
  true;
`;

export default function Index() {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  async function handleMessage(e: WebViewMessageEvent) {
    const { id, cmd, args } = JSON.parse(e.nativeEvent.data);
    try {
      const result = await runCommand(cmd, args);
      ref.current?.injectJavaScript(
        `window.__HAULT_MOBILE__.__resolve(${id}, true, ${JSON.stringify(result)});true;`,
      );
    } catch (err: any) {
      ref.current?.injectJavaScript(
        `window.__HAULT_MOBILE__.__resolve(${id}, false, ${JSON.stringify(err.message)});true;`,
      );
    }
  }

  if (!ready) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <WebView
        ref={ref}
        source={{ uri: API_BASE.replace(/\/api$/, '') }}
        injectedJavaScriptBeforeContentLoaded={BRIDGE}
        onMessage={handleMessage}
        style={styles.web}
      />
    </View>
  );
}

async function runCommand(cmd: string, args: any): Promise<unknown> {
  switch (cmd) {
    case 'native_info':
      return { platform: 'mobile', version: '0.1.0' };
    case 'secure.get':
      return SecureStore.getItemAsync(args.key);
    case 'secure.set':
      await SecureStore.setItemAsync(args.key, args.value);
      return { ok: true };
    case 'secure.delete':
      await SecureStore.deleteItemAsync(args.key);
      return { ok: true };
    default:
      throw new Error(`unknown native cmd: ${cmd}`);
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  web: { flex: 1, backgroundColor: '#0a0a0a' },
});
