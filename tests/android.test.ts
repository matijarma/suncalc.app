import test from "node:test";
import { SignJWT } from "jose";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { androidApi, interpret } from "../worker/android";

const MONTH = "suncalc_monthly",
  LIFE = "suncalc_lifetime",
  WEEK = 604800000;
const subscription = (
  state: string,
  end: number,
  ack = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
) => ({
  subscriptionState: "SUBSCRIPTION_STATE_" + state,
  acknowledgementState: ack,
  lineItems: [
    {
      productId: MONTH,
      expiryTime: new Date(end).toISOString(),
      offerDetails: { basePlanId: "monthly" },
    },
  ],
});
test("Google states: canceled remains usable to expiry; held, paused, pending and expired do not", () => {
  const t = Date.now();
  for (const state of ["ACTIVE", "CANCELED", "IN_GRACE_PERIOD"])
    assert.equal(
      interpret(MONTH, subscription(state, t + 30000), t).entitled,
      true,
    );
  for (const state of ["ON_HOLD", "PAUSED", "PENDING", "EXPIRED"])
    assert.equal(
      interpret(MONTH, subscription(state, t + 30000), t).entitled,
      false,
    );
  assert.equal(interpret(MONTH, subscription("ACTIVE", t), t).entitled, false);
  assert.equal(
    interpret(
      LIFE,
      {
        productLineItem: [{ productId: "wrong" }],
        purchaseStateContext: { purchaseState: "PURCHASED" },
      },
      t,
    ).entitled,
    false,
  );
});
test("first opening survives reinstall; verified grants restore to another device and revoke without erasing trials", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../migrations/0002_android.sql", import.meta.url),
      "utf8",
    ),
  );
  const db = {
    prepare: (q: string) => ({
      bind: (...v: any[]) => ({
        first: async () => sql.prepare(q).get(...v),
        run: async () => sql.prepare(q).run(...v),
      }),
    }),
    batch: async (rows: any[]) => {
      for (const r of rows) await r.run();
    },
  };
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const env: any = {
    DB: db,
    ANDROID_TRIAL_SECRET: "temporary-test-only",
    PLAY_SERVICE_ACCOUNT: JSON.stringify({
      client_email: "test@example.invalid",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    }),
  };
  const orig = globalThis.fetch;
  let state = "PENDING",
    acks = 0,
    unavailable = false;
  globalThis.fetch = async (input) => {
    const u = String(input);
    if (u.includes("v3/certs"))
      return Response.json({
        keys: [
          {
            ...publicKey.export({ format: "jwk" }),
            kid: "local",
            alg: "RS256",
          },
        ],
      });
    if (u.includes("oauth2"))
      return Response.json({ access_token: "unit-test", expires_in: 3600 });
    if (u.endsWith(":acknowledge")) {
      acks++;
      return new Response(null, { status: 204 });
    }
    if (unavailable) return new Response(null, { status: 503 });
    return Response.json({
      productLineItem: [{ productId: LIFE }],
      purchaseStateContext: { purchaseState: state },
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    });
  };
  const start = Date.now() - 2 * WEEK,
    one = "1".repeat(64),
    two = "2".repeat(64);
  const call = async (
    path: string,
    device: string,
    started = start,
    extra = {},
  ) =>
    androidApi(
      new Request("https://suncalc.app/api/android/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, install: device, started, ...extra }),
      }),
      env,
    );
  try {
    assert.equal(
      ((await (await call("state", one)).json()) as any).trialUntil,
      start + WEEK,
    );
    assert.equal(
      ((await (await call("state", one, Date.now())).json()) as any).trialUntil,
      start + WEEK,
    );
    const buy = { product: LIFE, token: "only-for-this-test" };
    assert.equal(
      ((await (await call("verify", one, start, buy)).json()) as any).lifetime,
      false,
    );
    assert.equal(acks, 0);
    state = "PURCHASED";
    for (const device of [one, two])
      assert.equal(
        ((await (await call("verify", device, start, buy)).json()) as any)
          .lifetime,
        true,
      );
    assert.equal(
      sql.prepare("SELECT count(*) n FROM android_purchases").get()!.n,
      1,
    );
    assert.notEqual(
      sql.prepare("SELECT token_hash FROM android_purchases").get()!.token_hash,
      buy.token,
    );
    const reinstalled = (await (
      await call("state", one, Date.now(), { install: "3".repeat(64) })
    ).json()) as any;
    assert.equal(reinstalled.lifetime, false);
    assert.equal(reinstalled.trialUntil, start + WEEK);
    unavailable = true;
    await assert.rejects(call("verify", one, start, buy));
    assert.equal(
      ((await (await call("state", one)).json()) as any).lifetime,
      true,
    );
    unavailable = false;
    state = "CANCELLED";
    await call("verify", two, start, buy);
    assert.equal(
      ((await (await call("state", one)).json()) as any).lifetime,
      false,
    );
    assert.equal((await call("notifications", one)).status, 503);
    env.PLAY_PUSH_EMAIL = "push@example.invalid";
    env.PLAY_PUSH_AUDIENCE = "https://suncalc.app/api/android/notifications";
    assert.equal((await call("notifications", one)).status, 401);
    const idToken = await new SignJWT({
      email: env.PLAY_PUSH_EMAIL,
      email_verified: true,
    })
      .setProtectedHeader({ alg: "RS256", kid: "local" })
      .setIssuer("https://accounts.google.com")
      .setAudience(env.PLAY_PUSH_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const notification = {
      packageName: "app.suncalc.planner",
      voidedPurchaseNotification: { purchaseToken: buy.token, productType: 2 },
    };
    const deliver = () =>
      androidApi(
        new Request(env.PLAY_PUSH_AUDIENCE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + idToken,
          },
          body: JSON.stringify({
            message: { data: btoa(JSON.stringify(notification)) },
          }),
        }),
        env,
      );
    state = "PURCHASED";
    assert.equal(
      ((await (await call("verify", one, start, buy)).json()) as any).lifetime,
      true,
    );
    assert.equal((await deliver()).status, 200);
    assert.equal((await deliver()).status, 200);
    assert.equal(
      ((await (await call("verify", one, start, buy)).json()) as any).lifetime,
      false,
    );
    assert.equal(
      ((await (await call("state", two)).json()) as any).lifetime,
      false,
    );
  } finally {
    globalThis.fetch = orig;
    sql.close();
  }
});
