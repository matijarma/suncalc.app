import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../migrations-usage/0001_usage.sql", import.meta.url),
      "utf8",
    ),
  );
  const db = {
    prepare(text: string) {
      const q = sql.prepare(text);
      function statement(args: any[]): any {
        return {
          bind: (...a: any[]) => statement(a),
          first: async () => q.get(...args),
          all: async () => ({ results: q.all(...args) }),
          run: async () => q.run(...args),
          execute: () => ({
            results: /^\s*SELECT/i.test(text)
              ? q.all(...args)
              : (q.run(...args), []),
          }),
        };
      }
      return statement([]);
    },
    batch: async (list: any[]) => {
      sql.exec("BEGIN");
      try {
        const r = list.map((s) => s.execute());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db: db as unknown as D1Database, sql };
}
