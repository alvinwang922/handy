import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectSeenUrls, toPartSearch, urlKey, type PartOptionsModelOutput } from "../lib/parts";
import { PartSearchSchema } from "../lib/schemas";

const HD = "https://www.homedepot.com/p/Liberty-1-1-4-in-Satin-Nickel-Round-Cabinet-Knob/100036093";
const AMZ = "https://www.amazon.com/Amerock-Cabinet-Knob-Satin-Nickel/dp/B000BQSEQ6";
const ACE = "https://www.acehardware.com/departments/hardware/cabinet-hardware/knobs/5019401";

// Response content as the API returns it: a search run inside dynamic filtering (has a caller),
// a failed search (error object, not a list), a fetched page, and a cited text block.
const content = [
  { type: "web_search_tool_result", tool_use_id: "s1", caller: { type: "code_execution_20260120" }, content: [{ type: "web_search_result", url: HD, title: "Knob", encrypted_content: "x", page_age: null }] },
  { type: "web_search_tool_result", tool_use_id: "s2", caller: { type: "direct" }, content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
  { type: "web_fetch_tool_result", tool_use_id: "f1", caller: { type: "direct" }, content: { type: "web_fetch_result", url: `${AMZ}?th=1`, retrieved_at: null, content: {} } },
  { type: "text", text: "Ace has it.", citations: [{ type: "web_search_result_location", url: `${ACE}/`, title: "Ace", cited_text: "", encrypted_index: "x" }] },
] as unknown as Anthropic.ContentBlock[];

const option = (o: Partial<PartOptionsModelOutput["options"][number]>): PartOptionsModelOutput["options"][number] => ({
  rank: 1,
  label: "Best match",
  product: "Liberty 1-1/4 in. Satin Nickel Round Cabinet Knob",
  brand: "Liberty",
  seller: "Home Depot",
  url: HD,
  priceUsd: 3.98,
  delivery: "Pickup today",
  returnPolicy: "90-day returns",
  rating: 4.7,
  reviewCount: 312,
  fitNote: "Standard 8-32 screw; check your door thickness.",
  ...o,
});
const ctx = () => ({ partName: "Cabinet knob, 1-1/4 in.", seenUrls: collectSeenUrls(content), searchedAt: "2026-10-11T18:00:00Z" });

describe("urlKey", () => {
  it("ignores www, query, hash and trailing slashes, and rejects non-https", () => {
    expect(urlKey("https://WWW.HomeDepot.com/p/x/1/?a=1#b")).toBe("homedepot.com/p/x/1");
    expect(urlKey("http://www.homedepot.com/p/x/1")).toBeNull();
    expect(urlKey("not a url")).toBeNull();
  });
});

describe("collectSeenUrls", () => {
  it("collects search results (incl. dynamic filtering), fetched pages and citations; skips error results", () => {
    expect([...collectSeenUrls(content)].sort()).toEqual([urlKey(ACE), urlKey(AMZ), urlKey(HD)].sort());
  });
});

describe("toPartSearch", () => {
  it("keeps verified options, ranked, and passes the schema", () => {
    const s = toPartSearch(
      {
        partName: "Cabinet knob, 1-1/4 in.",
        options: [
          option({ rank: 2, label: "Lowest price", seller: "Amazon", url: AMZ, priceUsd: 2.5 }),
          option({ rank: 1 }),
          option({ rank: 3, label: "Fastest to get", seller: "Ace Hardware", url: ACE }),
        ],
      },
      ctx(),
    );
    expect(PartSearchSchema.safeParse(s).success).toBe(true);
    expect(s).toMatchObject({ status: "ready", source: "claude", error: null });
    expect(s.options.map((o) => [o.rank, o.seller])).toEqual([[1, "Home Depot"], [2, "Amazon"], [3, "Ace Hardware"]]);
    expect(s.options[0].partName).toBe("Cabinet knob, 1-1/4 in.");
  });

  it("uses the agent's own resolved part name, not the fallback hint", () => {
    // The fallback hint (ctx.partName) is the repair's title for a pro-path search with no known
    // part; the agent must still report the concrete part it actually searched for.
    const s = toPartSearch(
      { partName: "Water heater heating element", options: [option({ rank: 1 })] },
      { partName: "Rumbling water heater with lukewarm hot water", seenUrls: collectSeenUrls(content), searchedAt: "2026-10-11T18:00:00Z" },
    );
    expect(s.partName).toBe("Water heater heating element");
    expect(s.options[0].partName).toBe("Water heater heating element");
  });

  it("falls back to the hint when the agent leaves partName blank", () => {
    const s = toPartSearch({ partName: "  ", options: [option({ rank: 1 })] }, ctx());
    expect(s.partName).toBe("Cabinet knob, 1-1/4 in.");
  });

  it("drops links the agent never saw, http links and duplicates, then renumbers", () => {
    const s = toPartSearch(
      {
        partName: "Cabinet knob, 1-1/4 in.",
        options: [
          option({ rank: 1, url: "https://www.homedepot.com/p/made-up/999" }),
          option({ rank: 2, url: HD.replace("https:", "http:") }),
          option({ rank: 3, url: AMZ, seller: "Amazon" }),
          option({ rank: 4, url: `${AMZ}?ref=dup`, seller: "Amazon again" }),
        ],
      },
      ctx(),
    );
    expect(s.options).toHaveLength(1);
    expect(s.options[0]).toMatchObject({ rank: 1, seller: "Amazon" });
  });

  it("caps at three options", () => {
    const urls = [HD, AMZ, ACE];
    const s = toPartSearch({ partName: "Cabinet knob, 1-1/4 in.", options: [...urls, HD].map((url, i) => option({ rank: i + 1, url })) }, ctx());
    expect(s.options).toHaveLength(3);
  });

  it("nulls missing or invalid numbers and clamps the rating", () => {
    const [o] = toPartSearch(
      { partName: "Cabinet knob, 1-1/4 in.", options: [option({ priceUsd: 0, rating: 7, reviewCount: -3, brand: "  ", delivery: "" })] },
      ctx(),
    ).options;
    expect(o).toMatchObject({ priceUsd: null, rating: 5, reviewCount: null, brand: null, delivery: null });
  });

  it("fails with a message when no option has a verified link", () => {
    const s = toPartSearch({ partName: "Cabinet knob, 1-1/4 in.", options: [option({ url: "https://www.lowes.com/pd/invented/1" })] }, ctx());
    expect(s).toMatchObject({ status: "failed", options: [] });
    expect(s.error).toMatch(/No verified product links/);
  });
});

describe("mock findPartOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns three labeled sample options without an API key", async () => {
    vi.stubEnv("MOCK_PARTS", "1");
    vi.resetModules(); // config is read at import time
    const { findPartOptions } = await import("../lib/parts");
    const s = await findPartOptions({
      diagnosis: {
        title: "Broken cabinet knob",
        likelyCause: "Cracked knob",
        trade: "handyman",
        urgency: "routine",
        needsOnsiteInspection: false,
        costRangeUsd: [80, 150],
        jobBrief: "",
        questionsForProviders: [],
        confidence: 0.8,
      },
      part: { name: "Cabinet knob, 1-1/4 in.", approxPriceUsd: 4, compatibility: "Check the screw length." },
    });
    expect(PartSearchSchema.safeParse(s).success).toBe(true);
    expect(s).toMatchObject({ status: "ready", source: "mock" });
    expect(s.options.map((o) => o.label)).toEqual(["Best match", "Lowest price", "Fastest to get"]);
    expect(s.options[0].fitNote).toMatch(/Sample result/);
  });
});
