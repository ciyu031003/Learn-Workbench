import { describe, it, expect, beforeEach } from "vitest";
import { useFocusBgStore, FOCUS_COLORS, FOCUS_GALLERY } from "./focus-bg-store";

beforeEach(() =>
  useFocusBgStore.setState({
    mode: "gallery",
    color: "#0f172a",
    uploadUrl: null,
    galleryId: "sunset",
    customQuote: null,
    minutes: 25,
  })
);

describe("useFocusBgStore", () => {
  it("exports focus palette and gallery presets", () => {
    expect(FOCUS_COLORS).toContain("#0f172a");
    expect(FOCUS_GALLERY[0]).toMatchObject({ id: "sunset", name: "黄昏暖阳" });
    expect(FOCUS_GALLERY.some((g) => g.id === "bing")).toBe(true);
  });

  it("starts with the default focus background state", () => {
    const s = useFocusBgStore.getState();
    expect(s.mode).toBe("gallery");
    expect(s.color).toBe("#0f172a");
    expect(s.uploadUrl).toBeNull();
    expect(s.galleryId).toBe("sunset");
    expect(s.customQuote).toBeNull();
    expect(s.minutes).toBe(25);
  });

  it("updates each field via its setter", () => {
    const s = useFocusBgStore.getState();
    s.setMode("color");
    s.setColor("#ff0000");
    s.setUploadUrl("https://img.test/a.png");
    s.setGalleryId("ocean");
    s.setCustomQuote("专注 25 分钟");
    s.setMinutes(50);
    const next = useFocusBgStore.getState();
    expect(next.mode).toBe("color");
    expect(next.color).toBe("#ff0000");
    expect(next.uploadUrl).toBe("https://img.test/a.png");
    expect(next.galleryId).toBe("ocean");
    expect(next.customQuote).toBe("专注 25 分钟");
    expect(next.minutes).toBe(50);
  });

  it("clears optional fields", () => {
    const s = useFocusBgStore.getState();
    s.setUploadUrl("x");
    s.setCustomQuote("q");
    s.setUploadUrl(null);
    s.setCustomQuote(null);
    expect(useFocusBgStore.getState().uploadUrl).toBeNull();
    expect(useFocusBgStore.getState().customQuote).toBeNull();
  });
});
