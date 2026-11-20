import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
export type AccessEnv = { ACCESS_ISSUER: string; ACCESS_AUD: string };
const jwks = new Map<string, JWTVerifyGetKey>();
export async function authorized(
  req: Request,
  env: AccessEnv,
  keys?: JWTVerifyGetKey,
) {
  const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
  if (
    !jwt ||
    jwt.length > 16384 ||
    !env.ACCESS_AUD ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER)
  )
    return false;
  try {
    let key = keys || jwks.get(env.ACCESS_ISSUER);
    if (!key) {
      key = createRemoteJWKSet(
        new URL(env.ACCESS_ISSUER + "/cdn-cgi/access/certs"),
        { timeoutDuration: 5000 },
      );
      jwks.set(env.ACCESS_ISSUER, key);
    }
    const { payload } = await jwtVerify(jwt, key, {
      issuer: env.ACCESS_ISSUER,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat"],
    });
    return typeof payload.email === "string" && !!payload.email;
  } catch {
    return false;
  }
}
