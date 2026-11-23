import { SignJWT, importPKCS8, createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "./api";

const PKG = "app.suncalc.planner",
  MONTH = "suncalc_monthly",
  LIFE = "suncalc_lifetime";
const GOOGLE =
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
  PKG +
  "/purchases/";
const DAY = 86400000,
  oidc = createRemoteJWKSet(
    new URL("https://www.googleapis.com/oauth2/v3/certs"),
  );
type AndroidEnv = Env & {
  ANDROID_TRIAL_SECRET?: string;
  PLAY_SERVICE_ACCOUNT?: string;
  ANDROID_LIMIT?: RateLimit;
  PLAY_PUSH_EMAIL?: string;
  PLAY_PUSH_AUDIENCE?: string;
};
type Grant = { entitled: boolean; until: number; ack: boolean };
const reply = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const encoder = new TextEncoder();
const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
const tokenHash = async (t: string) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(t)));
let cached: { access: string; expires: number; issuer: string } | undefined;

async function access(env: AndroidEnv) {
  if (!env.PLAY_SERVICE_ACCOUNT) throw Error("Publisher unconfigured");
  const sa = JSON.parse(env.PLAY_SERVICE_ACCOUNT);
  if (
    cached?.issuer === sa.client_email &&
    cached &&
    cached.expires > Date.now()
  )
    return cached.access;
  const url = "https://oauth2.googleapis.com/token";
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/androidpublisher",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(sa.client_email)
    .setAudience(url)
    .setIssuedAt()
    .setExpirationTime("55m")
    .sign(await importPKCS8(sa.private_key, "RS256"));
  const r = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!r.ok) throw Error("Publisher unavailable");
  const a = (await r.json()) as { access_token: string; expires_in: number };
  cached = {
    access: a.access_token,
    expires: Date.now() + (a.expires_in - 60) * 1000,
    issuer: sa.client_email,
  };
  return a.access_token;
}
export function interpret(product: string, data: any, now: number): Grant {
  if (product === LIFE) {
    const item = data.productLineItem?.find((p: any) => p.productId === LIFE);
    const entitled =
      !!item && data.purchaseStateContext?.purchaseState === "PURCHASED";
    return {
      entitled,
      until: 0,
      ack:
        entitled &&
        data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
    };
  }
  const until = Math.max(
    0,
    ...(data.lineItems ?? [])
      .filter(
        (v: any) =>
          v.productId === MONTH && v.offerDetails?.basePlanId === "monthly",
      )
      .map((v: any) => Date.parse(v.expiryTime) || 0),
  );
  const entitled =
    product === MONTH &&
    until > now &&
    [
      "SUBSCRIPTION_STATE_ACTIVE",
      "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
      "SUBSCRIPTION_STATE_CANCELED",
    ].includes(data.subscriptionState);
  return {
    entitled,
    until,
    ack:
      entitled && data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
  };
}
async function refresh(
  env: AndroidEnv,
  product: string,
  token: string,
  device?: string,
) {
  const th = await tokenHash(token),
    k = encodeURIComponent(token);
  const headers = { Authorization: "Bearer " + (await access(env)) };
  const r = await fetch(
    GOOGLE +
      (product === LIFE ? "productsv2/tokens/" : "subscriptionsv2/tokens/") +
      k,
    { headers },
  );
  const prior = await env.DB.prepare(
    "SELECT product,entitled FROM android_purchases WHERE token_hash=?",
  )
    .bind(th)
    .first<{ product: string; entitled: number }>();
  if (prior && (prior.product !== product || prior.entitled === -1))
    return false;
  if (!r.ok && r.status !== 410 && r.status !== 404)
    throw Error("Publisher verification unavailable");
  if (!r.ok && !prior) return false;
  const data = r.ok ? await r.json() : {},
    grant = interpret(product, data, Date.now());
  if (!prior && !grant.entitled) return false;
  const statements = [
    env.DB.prepare(
      "INSERT INTO android_purchases VALUES(?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET entitled=excluded.entitled, valid_until=excluded.valid_until WHERE product=excluded.product AND android_purchases.entitled<>-1",
    ).bind(th, product, Number(grant.entitled), grant.until),
  ];
  if (device && grant.entitled)
    statements.push(
      env.DB.prepare("INSERT OR IGNORE INTO android_devices VALUES(?,?)").bind(
        device,
        th,
      ),
    );
  await env.DB.batch(statements);
  if (grant.ack) {
    const path =
      (product === LIFE ? "products/" : "subscriptions/") +
      product +
      "/tokens/" +
      k +
      ":acknowledge";
    const a = await fetch(GOOGLE + path, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!a.ok) throw Error("Acknowledgement needs retry");
  }
  return grant.entitled;
}
export async function androidApi(req: Request, env: AndroidEnv) {
  const path = new URL(req.url).pathname.slice("/api/android/".length);
  if (
    req.method !== "POST" ||
    !["state", "verify", "notifications"].includes(path)
  )
    return reply({ error: "Not found" }, 404);
  if (
    req.headers.has("Origin") ||
    !req.headers.get("Content-Type")?.includes("application/json")
  )
    return reply({ error: "Invalid request" }, 403);
  if (path !== "notifications" && env.ANDROID_LIMIT) {
    const source = req.headers.get("CF-Connecting-IP");
    if (
      source &&
      !(await env.ANDROID_LIMIT.limit({ key: path + ":" + source })).success
    )
      return reply({ error: "Please try again in a minute." }, 429);
  }
  if (path === "notifications") {
    if (!env.PLAY_PUSH_EMAIL || !env.PLAY_PUSH_AUDIENCE)
      return reply({ error: "Not configured" }, 503);
    try {
      const { payload } = await jwtVerify(
        req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "",
        oidc,
        {
          audience: env.PLAY_PUSH_AUDIENCE,
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          algorithms: ["RS256"],
        },
      );
      if (
        payload.email !== env.PLAY_PUSH_EMAIL ||
        payload.email_verified !== true
      )
        throw Error();
    } catch {
      return reply({ error: "Unauthorized" }, 401);
    }
  }
  const raw = await req.text();
  if (raw.length > 16384) return reply({ error: "Too large" }, 413);
  let b;
  try {
    b = JSON.parse(raw);
    if (!b || typeof b !== "object") throw Error();
  } catch {
    return reply({ error: "Invalid body" }, 400);
  }
  if (path === "notifications") {
    let n;
    try {
      n = JSON.parse(atob(b.message.data));
    } catch {
      return reply({ error: "Invalid notification" }, 400);
    }
    if (n.packageName !== PKG || n.testNotification) return reply({ ok: true });
    const e =
      n.subscriptionNotification ??
      n.oneTimeProductNotification ??
      n.voidedPurchaseNotification;
    if (!e?.purchaseToken || typeof e.purchaseToken !== "string")
      return reply({ ok: true });
    const product = n.subscriptionNotification
      ? MONTH
      : n.oneTimeProductNotification
        ? e.sku
        : e.productType === 1
          ? MONTH
          : LIFE;
    if (product === MONTH || product === LIFE) {
      if (n.voidedPurchaseNotification && product === LIFE) {
        // A voided non-consumable is final. Retain a tombstone across redelivery.
        await env.DB.prepare(
          "INSERT INTO android_purchases VALUES(?,?, -1,0) ON CONFLICT(token_hash) DO UPDATE SET entitled=-1,valid_until=0",
        )
          .bind(await tokenHash(e.purchaseToken), product)
          .run();
      } else await refresh(env, product, e.purchaseToken);
    }
    return reply({ ok: true });
  }
  if (!env.ANDROID_TRIAL_SECRET) return reply({ error: "Not configured" }, 503);
  if (
    typeof b.device !== "string" ||
    !/^[a-f0-9]{64}$/.test(b.device) ||
    typeof b.install !== "string" ||
    !/^[a-f0-9]{64}$/.test(b.install) ||
    !Number.isSafeInteger(b.started) ||
    b.started <= 0
  )
    return reply({ error: "Invalid installation" }, 400);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.ANDROID_TRIAL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const device = hex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(b.device)),
  );
  // Device identity remembers trials only; paid access on a new install needs a Play restore.
  const install = await tokenHash("install:" + b.install);
  if (path === "verify") {
    if (
      ![MONTH, LIFE].includes(b.product) ||
      typeof b.token !== "string" ||
      !b.token ||
      b.token.length > 4096
    )
      return reply({ error: "Invalid purchase" }, 400);
    await refresh(env, b.product, b.token, install);
  }
  const now = Date.now();
  const row = await env.DB.prepare(
    "INSERT INTO android_trials VALUES(?,?) ON CONFLICT(device) DO UPDATE SET started=min(started,excluded.started) RETURNING started",
  )
    .bind(device, Math.min(now, b.started))
    .first<{ started: number }>();
  const ent = await env.DB.prepare(
    "SELECT MAX(CASE WHEN product=? THEN 1 ELSE 0 END) lifetime, MAX(CASE WHEN product=? THEN valid_until ELSE 0 END) monthly FROM android_devices JOIN android_purchases USING(token_hash) WHERE device=? AND entitled=1",
  )
    .bind(LIFE, MONTH, install)
    .first<{ lifetime: number; monthly: number }>();
  return reply({
    commerceReady: !!(
      env.PLAY_SERVICE_ACCOUNT &&
      env.PLAY_PUSH_EMAIL &&
      env.PLAY_PUSH_AUDIENCE
    ),
    serverTime: now,
    trialUntil: row!.started + 7 * DAY,
    lifetime: !!ent?.lifetime,
    monthlyUntil: ent?.monthly ?? 0,
  });
}
