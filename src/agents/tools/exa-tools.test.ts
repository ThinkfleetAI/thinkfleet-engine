import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createExaAnswerTool, createExaContentsTool, createExaResearchTool } from "./exa-tools.js";

const FAKE_EXA_KEY = "exa-test-key-123";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const priorFetch = global.fetch;
const priorEnv = { ...process.env };

function mockFetchOnce(body: unknown, status = 200, ok = true) {
  const fn = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  // @ts-expect-error mock fetch
  global.fetch = fn;
  return fn;
}

function mockFetchSequence(responses: Array<{ body: unknown; status?: number; ok?: boolean }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      statusText: r.ok === false ? "Error" : "OK",
      json: () => Promise.resolve(r.body),
      text: () => Promise.resolve(JSON.stringify(r.body)),
    });
  }
  // @ts-expect-error mock fetch
  global.fetch = fn;
  return fn;
}

function parseResult(result: { content: Array<{ text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

afterEach(() => {
  // @ts-expect-error restore
  global.fetch = priorFetch;
  process.env = { ...priorEnv };
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/*  Tool creation (enabled / disabled)                                         */
/* -------------------------------------------------------------------------- */

describe("exa tool creation", () => {
  it("returns null when no Exa API key is configured", () => {
    delete process.env.EXA_API_KEY;
    expect(createExaAnswerTool({ config: undefined })).toBeNull();
    expect(createExaContentsTool({ config: undefined })).toBeNull();
    expect(createExaResearchTool({ config: undefined })).toBeNull();
  });

  it("returns tool when EXA_API_KEY env var is set", () => {
    process.env.EXA_API_KEY = FAKE_EXA_KEY;
    expect(createExaAnswerTool()).not.toBeNull();
    expect(createExaContentsTool()).not.toBeNull();
    expect(createExaResearchTool()).not.toBeNull();
  });

  it("returns tool when config provides apiKey", () => {
    delete process.env.EXA_API_KEY;
    const config = { tools: { web: { search: { exa: { apiKey: FAKE_EXA_KEY } } } } };
    expect(createExaAnswerTool({ config: config as any })).not.toBeNull();
    expect(createExaContentsTool({ config: config as any })).not.toBeNull();
    expect(createExaResearchTool({ config: config as any })).not.toBeNull();
  });

  it("tools have correct names", () => {
    process.env.EXA_API_KEY = FAKE_EXA_KEY;
    expect(createExaAnswerTool()!.name).toBe("exa_answer");
    expect(createExaContentsTool()!.name).toBe("exa_contents");
    expect(createExaResearchTool()!.name).toBe("exa_research");
  });
});

/* -------------------------------------------------------------------------- */
/*  exa_answer                                                                 */
/* -------------------------------------------------------------------------- */

describe("exa_answer tool", () => {
  beforeEach(() => {
    process.env.EXA_API_KEY = FAKE_EXA_KEY;
  });

  it("sends correct request to Exa Answer API", async () => {
    const fetchMock = mockFetchOnce({
      answer: "The answer is 42.",
      citations: [{ title: "Source", url: "https://example.com" }],
    });

    const tool = createExaAnswerTool()!;
    await tool.execute!("call-1", { query: "What is the meaning of life?" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.exa.ai/answer");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-api-key"]).toBe(FAKE_EXA_KEY);

    const body = JSON.parse(opts.body);
    expect(body.query).toBe("What is the meaning of life?");
  });

  it("returns answer and citations on success", async () => {
    mockFetchOnce({
      answer: "42 is the answer.",
      citations: [{ title: "HHGTTG", url: "https://example.com/42", publishedDate: "1979-10-12" }],
    });

    const tool = createExaAnswerTool()!;
    const result = await tool.execute!("call-1", { query: "meaning of life" });
    const data = parseResult(result as any) as any;

    expect(data.provider).toBe("exa");
    expect(data.tool).toBe("exa_answer");
    expect(data.answer).toBe("42 is the answer.");
    expect(data.citations).toHaveLength(1);
    expect(data.citations[0].title).toBe("HHGTTG");
    expect(data.tookMs).toBeTypeOf("number");
  });

  it("includes domain filters when provided", async () => {
    const fetchMock = mockFetchOnce({ answer: "ok", citations: [] });

    const tool = createExaAnswerTool()!;
    await tool.execute!("call-1", {
      query: "test",
      includeDomains: ["wikipedia.org"],
      excludeDomains: ["reddit.com"],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.includeDomains).toEqual(["wikipedia.org"]);
    expect(body.excludeDomains).toEqual(["reddit.com"]);
  });

  it("throws on API error", async () => {
    mockFetchOnce({ error: "Unauthorized" }, 401, false);

    const tool = createExaAnswerTool()!;
    await expect(tool.execute!("call-1", { query: "test" })).rejects.toThrow(
      /Exa Answer API error \(401\)/,
    );
  });

  it("returns missing key payload when key resolves to undefined at execute time", async () => {
    // Create tool with key present, then remove it
    const tool = createExaAnswerTool()!;
    delete process.env.EXA_API_KEY;

    // The tool was created when key existed, but resolveExaApiKey re-checks at execute time
    // Since config was not provided (only env var), it will find no key
    const result = await tool.execute!("call-1", { query: "test" });
    const data = parseResult(result as any) as any;
    expect(data.error).toBe("missing_exa_api_key");
  });
});

/* -------------------------------------------------------------------------- */
/*  exa_contents                                                               */
/* -------------------------------------------------------------------------- */

describe("exa_contents tool", () => {
  beforeEach(() => {
    process.env.EXA_API_KEY = FAKE_EXA_KEY;
  });

  it("sends correct request to Exa Contents API", async () => {
    const fetchMock = mockFetchOnce({
      results: [{ url: "https://example.com", title: "Example", text: "Some content" }],
    });

    const tool = createExaContentsTool()!;
    await tool.execute!("call-1", { urls: ["https://example.com"] });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.exa.ai/contents");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.urls).toEqual(["https://example.com"]);
    expect(body.text.maxCharacters).toBe(2000); // default
    expect(body.highlights).toBe(true);
    expect(body.summary).toBe(true);
  });

  it("returns extracted content on success", async () => {
    mockFetchOnce({
      results: [
        {
          url: "https://example.com",
          title: "Example",
          text: "Page content here",
          highlights: ["key highlight"],
          summary: "A summary",
        },
      ],
    });

    const tool = createExaContentsTool()!;
    const result = await tool.execute!("call-1", { urls: ["https://example.com"] });
    const data = parseResult(result as any) as any;

    expect(data.provider).toBe("exa");
    expect(data.tool).toBe("exa_contents");
    expect(data.count).toBe(1);
    expect(data.results[0].url).toBe("https://example.com");
    expect(data.results[0].text).toBe("Page content here");
    expect(data.results[0].highlights).toEqual(["key highlight"]);
    expect(data.results[0].summary).toBe("A summary");
  });

  it("uses custom maxChars when provided", async () => {
    const fetchMock = mockFetchOnce({ results: [] });

    const tool = createExaContentsTool()!;
    await tool.execute!("call-1", { urls: ["https://example.com"], maxChars: 5000 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text.maxCharacters).toBe(5000);
  });

  it("handles empty results gracefully", async () => {
    mockFetchOnce({ results: [] });

    const tool = createExaContentsTool()!;
    const result = await tool.execute!("call-1", { urls: ["https://example.com"] });
    const data = parseResult(result as any) as any;

    expect(data.count).toBe(0);
    expect(data.results).toEqual([]);
  });

  it("handles missing results field", async () => {
    mockFetchOnce({});

    const tool = createExaContentsTool()!;
    const result = await tool.execute!("call-1", { urls: ["https://example.com"] });
    const data = parseResult(result as any) as any;

    expect(data.count).toBe(0);
    expect(data.results).toEqual([]);
  });

  it("throws on API error", async () => {
    mockFetchOnce({ error: "Bad Request" }, 400, false);

    const tool = createExaContentsTool()!;
    await expect(tool.execute!("call-1", { urls: ["https://example.com"] })).rejects.toThrow(
      /Exa Contents API error \(400\)/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  exa_research                                                               */
/* -------------------------------------------------------------------------- */

describe("exa_research tool", () => {
  beforeEach(() => {
    process.env.EXA_API_KEY = FAKE_EXA_KEY;
  });

  it("starts research task and polls for completion", async () => {
    const fetchMock = mockFetchSequence([
      // POST /research — start task
      { body: { id: "task-abc", status: "running" } },
      // GET /research/task-abc — still running
      { body: { id: "task-abc", status: "running" } },
      // GET /research/task-abc — completed
      {
        body: {
          id: "task-abc",
          status: "completed",
          output: "Research findings here",
          results: [{ title: "Source", url: "https://example.com", text: "relevant content" }],
        },
      },
    ]);

    const tool = createExaResearchTool()!;
    const result = await tool.execute!("call-1", { query: "AI safety research" });
    const data = parseResult(result as any) as any;

    expect(data.provider).toBe("exa");
    expect(data.tool).toBe("exa_research");
    expect(data.taskId).toBe("task-abc");
    expect(data.output).toBe("Research findings here");
    expect(data.results).toHaveLength(1);

    // Verify: first call is POST to /research, subsequent are GET to /research/{id}
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.exa.ai/research");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.exa.ai/research/task-abc");
    expect(fetchMock.mock.calls[1][1].method).toBe("GET");
  });

  it("includes instructions when provided", async () => {
    const fetchMock = mockFetchSequence([
      { body: { id: "task-123", status: "completed", output: "Done", results: [] } },
      // This won't actually be called since first response says completed,
      // but the poll logic first sleeps then fetches status — we need to handle
      // the task starting as completed immediately. Let's adjust the mock.
    ]);

    // Actually, the research tool ALWAYS starts a task and then polls.
    // Even if the start response has status "completed", the code still enters the poll loop.
    // Let me re-mock correctly:
    const fetchMock2 = mockFetchSequence([
      { body: { id: "task-123", status: "running" } },
      { body: { id: "task-123", status: "completed", output: "Done", results: [] } },
    ]);

    const tool = createExaResearchTool()!;
    await tool.execute!("call-1", {
      query: "quantum computing",
      instructions: "Focus on peer-reviewed sources",
    });

    const startBody = JSON.parse(fetchMock2.mock.calls[0][1].body);
    expect(startBody.query).toBe("quantum computing");
    expect(startBody.instructions).toBe("Focus on peer-reviewed sources");
  });

  it("throws when start response has no task ID", async () => {
    mockFetchOnce({ status: "running" }); // missing id

    const tool = createExaResearchTool()!;
    await expect(tool.execute!("call-1", { query: "test" })).rejects.toThrow(
      /did not return a task ID/,
    );
  });

  it("throws when research task fails", async () => {
    mockFetchSequence([
      { body: { id: "task-fail", status: "running" } },
      { body: { id: "task-fail", status: "failed", error: "Internal error" } },
    ]);

    const tool = createExaResearchTool()!;
    await expect(tool.execute!("call-1", { query: "test" })).rejects.toThrow(
      /Exa Research task failed: Internal error/,
    );
  });

  it("throws on API error during start", async () => {
    mockFetchOnce({ error: "Forbidden" }, 403, false);

    const tool = createExaResearchTool()!;
    await expect(tool.execute!("call-1", { query: "test" })).rejects.toThrow(
      /Exa Research API error \(403\)/,
    );
  });

  it("throws on API error during status poll", async () => {
    mockFetchSequence([
      { body: { id: "task-err", status: "running" } },
      { body: { error: "Server Error" }, status: 500, ok: false },
    ]);

    const tool = createExaResearchTool()!;
    await expect(tool.execute!("call-1", { query: "test" })).rejects.toThrow(
      /Exa Research status check error \(500\)/,
    );
  });
});
