/**
 * Runtime route Range-serving tests for video (mp4) + captions (vtt).
 *
 * Exercises the fd-based windowed reads and the open-ended-range cap added so a
 * large lesson MP4 never buffers whole-file per request. Writes real temp files
 * under runtime_artifacts/videos/_route_test/ (gitignored) and cleans up.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DIR = path.join(process.cwd(), "runtime_artifacts", "videos", "_route_test");
const MP4_REL = "runtime_artifacts/videos/_route_test/sample.mp4";
const BIG_REL = "runtime_artifacts/videos/_route_test/big.mp4";
const VTT_REL = "runtime_artifacts/videos/_route_test/sample.vtt";
const MP4_ABS = path.join(process.cwd(), MP4_REL);
const BIG_ABS = path.join(process.cwd(), BIG_REL);
const VTT_ABS = path.join(process.cwd(), VTT_REL);

const SMALL_SIZE = 4096;
const BIG_SIZE = 9 * 1024 * 1024; // > 8 MiB cap
const CAP = 8 * 1024 * 1024;

function segmentsFor(rel: string): string[] {
  return rel.split("/");
}

async function callGet(rel: string, range?: string) {
  const { GET } = await import("../app/runtime/[...path]/route");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = {};
  if (range) headers["range"] = range;
  const req = new NextRequest(`http://avo.test/runtime/${rel}`, { headers });
  return GET(req, { params: Promise.resolve({ path: segmentsFor(rel) }) });
}

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  // deterministic byte pattern so we can verify the window content
  const small = Buffer.alloc(SMALL_SIZE);
  for (let i = 0; i < SMALL_SIZE; i++) small[i] = i % 256;
  fs.writeFileSync(MP4_ABS, small);
  fs.writeFileSync(BIG_ABS, Buffer.alloc(BIG_SIZE, 7));
  fs.writeFileSync(VTT_ABS, "WEBVTT\n\n1\n00:00:00.000 --> 00:00:04.000\nhello\n");
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("runtime route — video Range serving", () => {
  it("serves a bounded range as 206 with correct Content-Range and window bytes", async () => {
    const res = await callGet(MP4_REL, "bytes=0-1023");
    expect(res.status).toBe(206);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-range")).toBe(`bytes 0-1023/${SMALL_SIZE}`);
    expect(res.headers.get("content-length")).toBe("1024");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(1024);
    // window content matches the deterministic pattern
    expect(buf[0]).toBe(0);
    expect(buf[255]).toBe(255);
    expect(buf[256]).toBe(0);
  });

  it("serves a mid-file range window from the correct offset", async () => {
    const res = await callGet(MP4_REL, "bytes=1000-1003");
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 1000-1003/${SMALL_SIZE}`);
    const buf = Buffer.from(await res.arrayBuffer());
    expect([...buf]).toEqual([1000 % 256, 1001 % 256, 1002 % 256, 1003 % 256]);
  });

  it("caps an open-ended range (bytes=0-) on a large file to the 8 MiB window", async () => {
    const res = await callGet(BIG_REL, "bytes=0-");
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 0-${CAP - 1}/${BIG_SIZE}`);
    expect(res.headers.get("content-length")).toBe(String(CAP));
  });

  it("does NOT cap an open-ended range that starts near the end (fits under cap)", async () => {
    const start = BIG_SIZE - 100;
    const res = await callGet(BIG_REL, `bytes=${start}-`);
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes ${start}-${BIG_SIZE - 1}/${BIG_SIZE}`);
    expect(res.headers.get("content-length")).toBe("100");
  });

  it("returns 416 for an unsatisfiable range", async () => {
    const res = await callGet(MP4_REL, `bytes=${SMALL_SIZE + 10}-`);
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe(`bytes */${SMALL_SIZE}`);
  });

  it("serves a full small file as 200 with Accept-Ranges", async () => {
    const res = await callGet(MP4_REL);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-length")).toBe(String(SMALL_SIZE));
    expect(res.headers.get("accept-ranges")).toBe("bytes");
  });

  it("streams a large non-range GET without buffering (200, full length)", async () => {
    const res = await callGet(BIG_REL);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String(BIG_SIZE));
    expect(res.body).toBeTruthy();
  });

  it("serves .vtt captions with text/vtt content type", async () => {
    const res = await callGet(VTT_REL);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/vtt; charset=utf-8");
    const text = await res.text();
    expect(text.startsWith("WEBVTT")).toBe(true);
  });
});
