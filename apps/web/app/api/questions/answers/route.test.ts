import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/interview", () => ({ listQuestionAnswers: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { listQuestionAnswers } from "@/lib/interview";
import { logger } from "@/lib/logger";
import { GET } from "./route";

const userMock = vi.mocked(currentUserId);
const answersMock = vi.mocked(listQuestionAnswers);
const errorMock = vi.mocked(logger.error);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/questions/answers", () => {
  it("未登录返回 401", async () => {
    userMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/questions/answers?ids=1"));
    expect(res.status).toBe(401);
    expect(answersMock).not.toHaveBeenCalled();
  });

  it("缺少或非法 ids 返回 400", async () => {
    userMock.mockResolvedValue("u-1");
    const res = await GET(new Request("http://localhost/api/questions/answers?ids=,x,-2"));
    expect(res.status).toBe(400);
    expect(answersMock).not.toHaveBeenCalled();
  });

  it("返回答案列表", async () => {
    userMock.mockResolvedValue("u-1");
    answersMock.mockResolvedValue([{ id: 7, answer: "JVM 是……" }]);
    const res = await GET(new Request("http://localhost/api/questions/answers?ids=7,8"));
    expect(res.status).toBe(200);
    expect((await res.json()).answers).toEqual([{ id: 7, answer: "JVM 是……" }]);
    expect(answersMock).toHaveBeenCalledWith([7, 8]);
  });

  it("单次最多 40 个 id（防滥用）", async () => {
    userMock.mockResolvedValue("u-1");
    answersMock.mockResolvedValue([]);
    const ids = Array.from({ length: 60 }, (_, i) => i + 1).join(",");
    await GET(new Request("http://localhost/api/questions/answers?ids=" + ids));
    expect(answersMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(answersMock).mock.calls[0][0]).toHaveLength(40);
  });

  it("查询失败返回 500 且记录日志", async () => {
    userMock.mockResolvedValue("u-1");
    answersMock.mockRejectedValue(new Error("boom"));
    const res = await GET(new Request("http://localhost/api/questions/answers?ids=1"));
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});
