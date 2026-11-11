import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { launchChrome } from "./chrome";

const origin = "http://localhost:3000";
const albumPage = "/storefront/us/album/6812476961";
const songId = "6812477273";
const release = new Date(2026, 10, 20);
const width = 1920;
const height = 1080;
const zoom = 1.32;
const fade = 3;
const out = path.join(import.meta.dir, "..", "out");
const stageUrl = `${origin}/__numeric_showcase`;

const perspective = (frames: number) => {
  const eased = `(1-cos(PI*min(in/${frames},1)))/2`;
  const inset = (size: string) => `${size}/2*(1-1/(1+${zoom - 1}*${eased}))`;
  const near = { x: inset("W"), y: inset("H") };
  const far = { x: `W-${inset("W")}`, y: `H-${inset("H")}` };
  return [
    `x0='${near.x}'`,
    `y0='${near.y}'`,
    `x1='${far.x}'`,
    `y1='${near.y}'`,
    `x2='${near.x}'`,
    `y2='${far.y}'`,
    `x3='${far.x}'`,
    `y3='${far.y}'`,
  ].join(":");
};

const seconds = (stamp: string) =>
  stamp.split(":").reduce((total, part) => total * 60 + Number(part), 0);

const fetchSong = async () => {
  const audio = Bun.file(path.join(out, "song.m4a"));
  const lyrics = Bun.file(path.join(out, "song.ttml"));

  if (!(await audio.exists())) {
    const resolved = await fetch(
      "https://gamdl.thereallo.dev/v1/apple-music/resolve",
      {
        body: JSON.stringify({ id: songId }),
        headers: {
          Authorization: `Bearer ${Bun.env.GAMDL_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }
    );
    const { audioUrl } = (await resolved.json()) as { audioUrl: string };
    await Bun.write(audio, await fetch(audioUrl));
  }

  if (!(await lyrics.exists())) {
    await Bun.write(
      lyrics,
      await fetch(`https://am-hook.1412520.xyz/lyrics/${songId}`)
    );
  }

  const chorus = (await lyrics.text())
    .match(/<div [^>]*>/gu)
    ?.find((tag) => tag.includes('songPart="Chorus"'));
  const begin = chorus?.match(/ begin="(?<time>[^"]+)"/u)?.groups?.time;
  const end = chorus?.match(/ end="(?<time>[^"]+)"/u)?.groups?.time;

  if (!begin || !end) {
    throw new Error("the lyrics name no chorus");
  }

  return { audio: audio.name ?? "", begin: seconds(begin), end: seconds(end) };
};

await mkdir(out, { recursive: true });
const song = await fetchSong();
const duration = Number(Bun.env.CLIP ?? song.end - song.begin + fade * 2);
const stage = (
  await readFile(path.join(import.meta.dir, "..", "stage", "stage.html"), "utf8")
).replace("{{page}}", albumPage);
const chrome = await launchChrome(width, height + 120);
await chrome.send("Network.enable");
await chrome.send("Network.setCookies", {
  cookies: JSON.parse(await readFile(path.join(out, "cookies.json"), "utf8")),
});
await chrome.send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-color-scheme", value: "light" }],
});

chrome.on("Fetch.requestPaused", ({ requestId }) => {
  void chrome.send("Fetch.fulfillRequest", {
    body: Buffer.from(stage).toString("base64"),
    requestId,
    responseCode: 200,
    responseHeaders: [{ name: "Content-Type", value: "text/html" }],
  });
});

await chrome.send("Fetch.enable", {
  patterns: [{ urlPattern: `${stageUrl}*` }],
});
await chrome.send("Page.enable");
await chrome.send("Page.addScriptToEvaluateOnNewDocument", {
  source:
    "{ const now = Date.now.bind(Date); window.dateShift = 0; Date.now = () => now() + window.dateShift; }",
});
const loaded = chrome.once("Page.loadEventFired");
await chrome.send("Page.navigate", { url: stageUrl });
await loaded;

const evaluate = async <T>(expression: string) => {
  const { exceptionDetails, result } = await chrome.send<{
    exceptionDetails?: { exception?: { description?: string } };
    result: { value: T };
  }>("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
    userGesture: true,
  });

  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? expression);
  }

  return result.value;
};

while (!(await evaluate<boolean>("showcase.ready()"))) {
  await Bun.sleep(1000);
}

await Bun.sleep(3000);
const { chunks: chunkCount, crop } = await evaluate<{
  chunks: number;
  crop: { height: number; width: number; x: number; y: number };
}>(
  `showcase.record(${JSON.stringify({
    duration: duration * 1000,
    lead: 1500,
    rollover: release.getTime() - 86_399_000,
    rolloverLead: (fade + 2.5) * 1000,
  })})`
);
const recording = path.join(out, "recording.mp4");
const chunks = await Promise.all(
  Array.from({ length: chunkCount }, (_, index) =>
    evaluate<string>(`showcase.chunk(${index})`)
  )
);
await Bun.write(
  recording,
  Buffer.concat(chunks.map((chunk) => Buffer.from(chunk, "base64")))
);
await chrome.close();

const output = path.join(out, "numeric-showcase.mp4");
const mux = Bun.spawn([
  "ffmpeg",
  "-y",
  "-loglevel",
  "error",
  "-i",
  recording,
  "-ss",
  String(song.begin - fade),
  "-t",
  String(duration),
  "-i",
  song.audio,
  "-filter:v",
  [
    `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
    "fps=60",
    `perspective=${perspective(duration * 60)}:interpolation=cubic:eval=frame`,
    "scale=1920:1080:flags=lanczos",
  ].join(","),
  "-af",
  `afade=t=in:d=${fade},afade=t=out:st=${duration - fade}:d=${fade}`,
  "-map",
  "0:v",
  "-map",
  "1:a",
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-crf",
  "14",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "256k",
  "-shortest",
  "-movflags",
  "+faststart",
  output,
]);
await mux.exited;
console.log(output);
