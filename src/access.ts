import { read, write } from "./storage";
export type Access = {
  mode: "preview" | "live";
  paid?: boolean;
  until?: number;
  recovery?: string;
};
export const initialAccess = (): Access => read("access", { mode: "preview" });
type Replies = {
  start: Access;
  status: Access;
  confirm: Access & { pending?: boolean; status?: string };
  checkout: { url: string; ref: string };
  restore: Access;
  address: { places: import("./solar").Spot[] };
};
export async function post<K extends keyof Replies>(
  route: K,
  body: object = {},
  auth = false,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    let id = read<string>("install", "");
    if (!id) {
      id = crypto.randomUUID();
      write("install", id);
    }
    headers.Authorization = "Bearer " + id;
  }
  const res = await fetch("/api/" + route, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "omit",
  });
  const value = (await res.json()) as Replies[K] & { error?: string };
  if (!res.ok) throw Error(value.error || "Please try again.");
  return value;
}
export async function settings() {
  const r = await fetch("/api/config", {
    credentials: "omit",
    cache: "no-store",
  });
  if (!r.ok) throw Error();
  return r.json() as Promise<{
    mode: "preview" | "live";
    addressLookup: boolean;
  }>;
}
export const persist = (a: Access) => {
  write("access", a);
  return a;
};
