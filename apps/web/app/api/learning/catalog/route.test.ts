import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/learning", () => ({ learningCatalog: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { learningCatalog } from "@/lib/learning";
import { GET } from "./route";

const catalogMock = vi.mocked(learningCatalog);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/learning/catalog", () => {
  it("returns the static learning catalog", async () => {
    catalogMock.mockReturnValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).tracks).toEqual([]);
  });
});

