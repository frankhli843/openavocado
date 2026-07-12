import { describe, expect, it } from "vitest";
import {
  canServeArtifactSandbox,
  hostnameFromRequestHost,
  isLocalSandboxQaHost,
} from "@/lib/visual-artifacts/sandbox-access";

describe("visual artifact sandbox access", () => {
  it("serves approved artifacts from any host", () => {
    expect(canServeArtifactSandbox({
      buildStatus: "qa_approved",
      qaMode: null,
      hostname: "demo.example.com",
    })).toBe(true);
  });

  it("serves pending QA artifacts only through local reviewer preview", () => {
    expect(canServeArtifactSandbox({
      buildStatus: "pending_qa",
      qaMode: "pending",
      hostname: "127.0.0.1",
    })).toBe(true);
    expect(canServeArtifactSandbox({
      buildStatus: "pending_qa",
      qaMode: "pending",
      hostname: "localhost",
    })).toBe(true);
    expect(canServeArtifactSandbox({
      buildStatus: "pending_qa",
      qaMode: "pending",
      hostname: "demo.example.com",
    })).toBe(false);
    expect(canServeArtifactSandbox({
      buildStatus: "pending_qa",
      qaMode: null,
      hostname: "127.0.0.1",
    })).toBe(false);
  });

  it("recognizes localhost forms for Chrome MCP running on the server", () => {
    expect(isLocalSandboxQaHost("127.0.0.1")).toBe(true);
    expect(isLocalSandboxQaHost("localhost")).toBe(true);
    expect(isLocalSandboxQaHost("[::1]")).toBe(true);
    expect(isLocalSandboxQaHost("203.0.113.10")).toBe(false);
  });

  it("derives QA hostnames from real request Host headers", () => {
    expect(hostnameFromRequestHost("localhost:3742")).toBe("localhost");
    expect(hostnameFromRequestHost("127.0.0.1:3742")).toBe("127.0.0.1");
    expect(hostnameFromRequestHost("[::1]:3742")).toBe("::1");
    expect(hostnameFromRequestHost("203.0.113.10:3742")).toBe("203.0.113.10");
    expect(isLocalSandboxQaHost(hostnameFromRequestHost("203.0.113.10:3742"))).toBe(false);
  });
});
