/**
 * ObservationStore — SQLite persistence for observation entries.
 *
 * Opens its own read/write connection to the existing memory DB file.
 * SQLite WAL mode (set by MemoryIndexManager) allows concurrent readers.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { resolveUserPath } from "../../utils.js";
import { ensureDir } from "../internal.js";
import { requireNodeSqlite } from "../sqlite.js";
import type { Observation } from "./types.js";

const log = createSubsystemLogger("observational-store");

export class ObservationStore {
  private db: import("node:sqlite").DatabaseSync;
  private closed = false;

  constructor(dbPath: string) {
    const resolved = resolveUserPath(dbPath);
    ensureDir(path.dirname(resolved));
    const { DatabaseSync } = requireNodeSqlite();
    this.db = new DatabaseSync(resolved);
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY,
        session_key TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        message_start_index INTEGER NOT NULL,
        message_end_index INTEGER NOT NULL,
        token_estimate INTEGER NOT NULL,
        generation INTEGER NOT NULL DEFAULT 0,
        priority INTEGER NOT NULL DEFAULT 5
      );
    `);
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_observations_session
       ON observations(session_key, generation, created_at);`,
    );
  }

  insert(obs: Omit<Observation, "id">): Observation {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO observations (id, session_key, content, created_at,
         message_start_index, message_end_index, token_estimate, generation, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        obs.sessionKey,
        obs.content,
        obs.createdAt,
        obs.messageStartIndex,
        obs.messageEndIndex,
        obs.tokenEstimate,
        obs.generation,
        obs.priority,
      );
    return { id, ...obs };
  }

  getForSession(sessionKey: string, generation?: number): Observation[] {
    const sql =
      generation !== undefined
        ? `SELECT * FROM observations WHERE session_key = ? AND generation = ? ORDER BY created_at ASC`
        : `SELECT * FROM observations WHERE session_key = ? ORDER BY generation ASC, created_at ASC`;

    const params = generation !== undefined ? [sessionKey, generation] : [sessionKey];
    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      session_key: string;
      content: string;
      created_at: number;
      message_start_index: number;
      message_end_index: number;
      token_estimate: number;
      generation: number;
      priority: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      sessionKey: row.session_key,
      content: row.content,
      createdAt: row.created_at,
      messageStartIndex: row.message_start_index,
      messageEndIndex: row.message_end_index,
      tokenEstimate: row.token_estimate,
      generation: row.generation,
      priority: row.priority,
    }));
  }

  getObservationTokens(sessionKey: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(token_estimate), 0) AS total FROM observations WHERE session_key = ?`,
      )
      .get(sessionKey) as { total: number } | undefined;
    return row?.total ?? 0;
  }

  /**
   * Returns the highest message_end_index across all observations for this session.
   * This is the "high water mark" — messages before this index have been observed.
   */
  getHighWaterMark(sessionKey: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(MAX(message_end_index), 0) AS hwm FROM observations WHERE session_key = ?`,
      )
      .get(sessionKey) as { hwm: number } | undefined;
    return row?.hwm ?? 0;
  }

  /**
   * Atomically replace all observations of a given generation for a session.
   * Used by the Reflector to swap gen-0 observations with compressed gen-1.
   */
  replaceObservations(
    sessionKey: string,
    oldGeneration: number,
    newObservations: Omit<Observation, "id">[],
  ): void {
    this.db.exec("BEGIN TRANSACTION");
    try {
      this.db
        .prepare(`DELETE FROM observations WHERE session_key = ? AND generation = ?`)
        .run(sessionKey, oldGeneration);
      for (const obs of newObservations) {
        this.insert(obs);
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  deleteForSession(sessionKey: string): void {
    this.db.prepare(`DELETE FROM observations WHERE session_key = ?`).run(sessionKey);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.db.close();
    } catch (err) {
      log.debug(`error closing observation store: ${String(err)}`);
    }
  }
}
