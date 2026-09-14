import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/config", () => ({ getApiUrl: vi.fn(() => "http://test") }));
vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: vi.fn(() => ({ token: "tok-1", apiUrl: undefined })) },
}));

import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import {
  fetchDomains,
  createDomain,
  updateDomain,
  archiveDomain,
  restoreDomain,
  deleteDomain,
  domainIconName,
} from "./domains";

const getApiUrlMock = vi.mocked(getApiUrl);
const getStateMock = vi.mocked(useAppStore.getState);
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getApiUrlMock.mockReturnValue("http://test");
  getStateMock.mockReturnValue({ token: "tok-1", apiUrl: undefined } as never);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.unstubAllGlobals?.();
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const domainA = {
  career_key: "english-c-abc",
  name: "英语学习",
  description: null,
  is_locked: false,
  sort_order: 1,
  owner_id: null,
  kind: "language",
  icon: "languages",
  color: "#2563eb",
  phase_prefix: "E",
  is_archived: false,
  kind_label: "语言学习",
};

describe("domains client", () => {
  it("fetchDomains lists active domains and passes the query", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ domains: [domainA], templates: [] }));
    const res = await fetchDomains({ templates: true });
    expect(res.domains).toHaveLength(1);
    expect(res.domains[0].career_key).toBe("english-c-abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test/api/domains?templates=1",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok-1" }) })
    );
  });

  it("createDomain POSTs and returns the created domain", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ domain: domainA }, true, 201));
    const d = await createDomain({ template: "english" });
    expect(d.career_key).toBe("english-c-abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test/api/domains",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ template: "english" }) })
    );
  });

  it("updateDomain PATCHes the right key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ domain: { ...domainA, name: "改名" } }));
    const d = await updateDomain({ key: "english-c-abc", color: "#ea580c" });
    expect(d.name).toBe("改名");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test/api/domains",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ key: "english-c-abc", color: "#ea580c" }) })
    );
  });

  it("archiveDomain / restoreDomain set isArchived", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ domain: domainA }));
    await archiveDomain("k");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://test/api/domains",
      expect.objectContaining({ body: JSON.stringify({ key: "k", isArchived: true }) })
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ domain: domainA }));
    await restoreDomain("k");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://test/api/domains",
      expect.objectContaining({ body: JSON.stringify({ key: "k", isArchived: false }) })
    );
  });

  it("deleteDomain issues DELETE with query key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await deleteDomain("english-c-abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test/api/domains?key=english-c-abc",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("surfaces server error message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "请先登录" }, false, 401));
    await expect(fetchDomains()).rejects.toThrow("请先登录");
  });

  it("domainIconName falls back to compass for unknown icons", () => {
    expect(domainIconName("languages")).toBe("language-outline");
    expect(domainIconName("dumbbell")).toBe("barbell-outline");
    expect(domainIconName("unknown")).toBe("compass-outline");
    expect(domainIconName(null)).toBe("compass-outline");
  });
});
