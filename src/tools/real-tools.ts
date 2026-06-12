import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

/**
 * REAL tool implementations. These actually do things — search the live web,
 * read/write real files in a sandbox, make real HTTP requests. They run ONLY
 * after the policy gate has returned ALLOW for the call (the gate wraps every
 * one of these). The point of the project is the authorization decision; these
 * make the decision consequential instead of cosmetic.
 */

export interface ToolImpl {
  description: string;
  /** JSON-schema-ish parameter shape, also reused to build the AI SDK Zod tool. */
  params: Record<string, { type: string; description: string; optional?: boolean }>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

// Files are confined to a real sandbox dir. The policy maps logical paths like
// "/workspace/**"; we translate "/workspace" → SANDBOX_ROOT and hard-contain.
const SANDBOX_ROOT = resolve(process.env.SANDBOX_ROOT ?? join(process.cwd(), "data", "workspace"));

function toSandbox(logicalPath: string): string {
  const rel = logicalPath.replace(/^\/workspace\/?/, "").replace(/^\/+/, "");
  const abs = resolve(SANDBOX_ROOT, normalize(rel));
  if (abs !== SANDBOX_ROOT && !abs.startsWith(SANDBOX_ROOT + "/")) {
    throw new Error(`path escapes sandbox: ${logicalPath}`);
  }
  return abs;
}

export const realTools: Record<string, ToolImpl> = {
  web_search: {
    description: "Search the live web for current information. Returns top results with titles, URLs, and snippets.",
    params: { query: { type: "string", description: "The search query" } },
    run: async (args) => webSearch(String(args.query ?? ""), Number(args.maxResults ?? 5)),
  },

  file_read: {
    description: "Read a UTF-8 text file from the agent workspace.",
    params: { path: { type: "string", description: "Absolute path under /workspace" } },
    run: async (args) => {
      const p = toSandbox(String(args.path));
      const content = await readFile(p, "utf-8");
      return { path: args.path, bytes: Buffer.byteLength(content), content: content.slice(0, 20_000) };
    },
  },

  file_write: {
    description: "Write a UTF-8 text file to the agent workspace (creates directories as needed).",
    params: {
      path: { type: "string", description: "Absolute path under /workspace" },
      content: { type: "string", description: "File contents" },
    },
    run: async (args) => {
      const p = toSandbox(String(args.path));
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, String(args.content ?? ""), "utf-8");
      const s = await stat(p);
      return { path: args.path, bytesWritten: s.size };
    },
  },

  http_request: {
    description: "Make a real outbound HTTP request and return status, headers, and a snippet of the body.",
    params: {
      url: { type: "string", description: "Target URL" },
      method: { type: "string", description: "HTTP method (GET/POST)", optional: true },
      body: { type: "string", description: "Request body for POST", optional: true },
    },
    run: async (args) => {
      const method = String(args.method ?? "GET").toUpperCase();
      const res = await fetch(String(args.url), {
        method,
        headers: { "user-agent": "eigen-tool-gate/0.1" },
        body: method === "GET" || method === "HEAD" ? undefined : (args.body as string | undefined),
        signal: AbortSignal.timeout(12_000),
      });
      const text = await res.text();
      return {
        url: args.url,
        status: res.status,
        contentType: res.headers.get("content-type") ?? "",
        body: text.slice(0, 4_000),
        truncated: text.length > 4_000,
      };
    },
  },

  file_delete: {
    description: "Permanently delete a file from the agent workspace. Destructive.",
    params: { path: { type: "string", description: "Absolute path under /workspace" } },
    run: async (args) => {
      const { unlink } = await import("node:fs/promises");
      const p = toSandbox(String(args.path));
      try {
        await unlink(p);
        return { path: args.path, deleted: true };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          return { path: args.path, deleted: false, note: "file did not exist" };
        }
        throw err;
      }
    },
  },

  db_query: {
    description: "Run a read-only SQL query against the audit database (the decision log itself).",
    params: { sql: { type: "string", description: "A SELECT statement" } },
    run: async (args) => dbQuery(String(args.sql ?? args.query ?? ""), Number(args.maxRows ?? 100)),
  },

  shell_exec: {
    description: "Execute a shell command. (Denied by the demo policy — present so the gate has something to block.)",
    params: { command: { type: "string", description: "Command to run" } },
    run: async (args) => {
      // Real implementation, but the policy DENIES this tool, so the gate stops
      // it before we ever get here. If a policy ever allowed it, it would run for real.
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const run = promisify(execFile);
      const { stdout, stderr } = await run("/bin/sh", ["-c", String(args.command)], { timeout: 5_000 });
      return { command: args.command, stdout: stdout.slice(0, 4_000), stderr: stderr.slice(0, 2_000) };
    },
  },
};

/** Tavily live web search (same provider as the multi-agent series project). */
async function webSearch(query: string, maxResults: number): Promise<unknown> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    return { query, note: "TAVILY_API_KEY not set", results: [] as unknown[] };
  }
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const data = (await res.json()) as { answer?: string; results?: Array<{ title: string; url: string; content: string }> };
  return {
    query,
    answer: data.answer ?? null,
    results: (data.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 300) })),
  };
}

// Lazy, shared read pool for db_query against the co-located Postgres.
let dbPool: import("pg").Pool | null = null;

/**
 * Real SQL against the audit database (the same Postgres that stores the
 * decision log). The gate's allowed_sql constraint blocks anything but SELECT
 * before we get here, so a DROP/DELETE never reaches this code. We add a defensive
 * LIMIT and a statement_timeout as belt-and-suspenders.
 */
async function dbQuery(sql: string, maxRows: number): Promise<unknown> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return { error: "no database configured (DATABASE_URL unset)", rows: [] as unknown[] };
  }
  if (!dbPool) {
    const pg = (await import("pg")).default;
    dbPool = new pg.Pool({ connectionString: url, max: 2, statement_timeout: 5_000 });
  }
  const res = await dbPool.query(sql);
  return {
    rowCount: res.rowCount,
    rows: res.rows.slice(0, Math.max(1, maxRows)),
    truncated: (res.rows?.length ?? 0) > maxRows,
  };
}
