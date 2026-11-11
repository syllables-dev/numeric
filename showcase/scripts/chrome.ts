import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

type Listener = (params: Record<string, unknown>) => void;

export interface Session {
  close: () => Promise<void>;
  on: (event: string, listener: Listener) => void;
  once: (event: string) => Promise<Record<string, unknown>>;
  send: <T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>
  ) => Promise<T>;
}

const debuggerUrl = async (port: number) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = (await response.json()) as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      const page = targets.find(({ type }) => type === "page");

      if (page) {
        return page.webSocketDebuggerUrl;
      }
    } catch {
      await Bun.sleep(100);
    }
  }

  throw new Error("chrome never opened a page");
};

export const launchChrome = async (width: number, height: number) => {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = await mkdtemp(path.join(tmpdir(), "numeric-showcase-"));
  const chrome = Bun.spawn(
    [
      chromePath,
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--force-color-profile=srgb",
      "--auto-accept-this-tab-capture",
      "--auto-accept-this-tab-capture",
      "--autoplay-policy=no-user-gesture-required",
      "about:blank",
    ],
    { stderr: "ignore", stdout: "ignore" }
  );
  const socket = new WebSocket(await debuggerUrl(port));
  await new Promise((resolve) => socket.addEventListener("open", resolve));
  const pending = new Map<number, (message: Record<string, unknown>) => void>();
  const listeners = new Map<string, Listener[]>();
  const onceListeners = new Map<string, Listener[]>();
  let nextId = 0;

  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data)) as {
      error?: { message: string };
      id?: number;
      method?: string;
      params?: Record<string, unknown>;
      result?: Record<string, unknown>;
    };

    if (message.id !== undefined) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
      return;
    }

    for (const listener of listeners.get(message.method ?? "") ?? []) {
      listener(message.params ?? {});
    }

    for (const listener of onceListeners.get(message.method ?? "") ?? []) {
      listener(message.params ?? {});
    }

    onceListeners.delete(message.method ?? "");
  });

  const session: Session = {
    close: async () => {
      socket.close();
      chrome.kill();
      await chrome.exited;
    },
    on: (event, listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    once: (event) =>
      new Promise((resolve) => {
        onceListeners.set(event, [
          ...(onceListeners.get(event) ?? []),
          resolve,
        ]);
      }),
    send: (method, params = {}) => {
      nextId += 1;
      const id = nextId;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, (message) => {
          const { error, result } = message as {
            error?: { message: string };
            result: never;
          };

          if (error) {
            reject(new Error(`${method}: ${error.message}`));
          } else {
            resolve(result);
          }
        });
      });
    },
  };

  return session;
};
