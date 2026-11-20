import {
  WorkflowEntrypoint,
  type WorkflowStep,
  type WorkflowEvent,
} from "cloudflare:workers";

// All instances read one immutable OSM edition. The workflow is operator-only:
// no customer request causes a download from a public map service.
const key = "20261118.pmtiles",
  size = 139594494611,
  etag = '"f80d23ebf8f97045b56ad0bc73b8ec76-521"',
  part = 64 * 1024 * 1024;
const count = Math.ceil(size / part),
  lanes = 12,
  parallel = 2;
type Job = {
  lane?: number;
  upload?: string;
  done?: R2UploadedPart[];
  start?: number;
};
type Bindings = { MAPS: R2Bucket; IMPORT: Workflow<Job> };
async function copy(bucket: R2Bucket, id: string, n: number) {
  const start = n * part,
    end = Math.min(size, start + part) - 1;
  const r = await fetch("https://build.protomaps.com/" + key, {
    headers: { Range: "bytes=" + start + "-" + end, "If-Match": etag },
  });
  if (
    r.status !== 206 ||
    !r.body ||
    r.headers.get("content-range") !==
      "bytes " + start + "-" + end + "/" + size ||
    r.headers.get("etag") !== etag
  )
    throw Error("Incomplete or changed map source");
  return bucket.resumeMultipartUpload(key, id).uploadPart(n + 1, r.body);
}
export class MapImport extends WorkflowEntrypoint<Bindings, Job> {
  async run(event: WorkflowEvent<Job>, step: WorkflowStep) {
    const job = event.payload ?? {},
      bucket = this.env.MAPS;
    if (job.lane !== undefined) {
      if (
        !job.upload ||
        !Number.isInteger(job.lane) ||
        job.lane < 0 ||
        job.lane >= lanes
      )
        throw Error("Invalid import lane");
      const parts: R2UploadedPart[] = [];
      for (
        let n = (job.start ?? 0) + job.lane * parallel;
        n < count;
        n += lanes * parallel
      ) {
        const group = await step.do(
          "parts " + n,
          {
            retries: { limit: 7, delay: "5 seconds", backoff: "exponential" },
            timeout: "12 minutes",
          },
          () =>
            Promise.all(
              Array.from({ length: Math.min(parallel, count - n) }, (_, i) =>
                copy(bucket, job.upload!, n + i),
              ),
            ),
        );
        parts.push(...group);
      }
      return parts;
    }
    if (
      await step.do(
        "archive present",
        async () => (await bucket.head(key))?.size === size,
      )
    )
      return "already imported";
    const done = job.done ?? [];
    if (done.some((p, i) => p.partNumber !== i + 1) || done.length > count)
      throw Error("Non-contiguous resume manifest");
    const upload =
      job.upload ??
      (await step.do(
        "open multipart upload",
        async () =>
          (
            await bucket.createMultipartUpload(key, {
              customMetadata: { source: "Protomaps / OSM", build: "20261118" },
            })
          ).uploadId,
      ));
    const ids = Array.from(
      { length: lanes },
      (_, n) => event.instanceId + "-lane-" + n,
    );
    await step.do("start parallel import", async () => {
      await this.env.IMPORT.createBatch(
        ids.map((id, lane) => ({
          id,
          params: { lane, start: done.length, upload },
        })),
      );
      return ids;
    });
    for (let poll = 0; poll < 720; poll++) {
      const states = await step.do("lane status " + poll, async () =>
        Promise.all(
          ids.map(
            async (id) =>
              (await (await this.env.IMPORT.get(id)).status()).status,
          ),
        ),
      );
      if (states.every((s) => s === "complete")) break;
      if (states.some((s) => s === "errored" || s === "terminated"))
        throw Error("An import lane failed; inspect its retry history");
      if (poll === 719) throw Error("Import did not finish in six hours");
      await step.sleep("allow transfers " + poll, "30 seconds");
    }
    await step.do(
      "publish verified archive",
      {
        timeout: "10 minutes",
        retries: { limit: 4, delay: "15 seconds", backoff: "exponential" },
      },
      async () => {
        if ((await bucket.head(key))?.size === size) return;
        const groups = await Promise.all(
          ids.map(
            async (id) =>
              (await (await this.env.IMPORT.get(id)).status())
                .output as R2UploadedPart[],
          ),
        );
        const parts = [...done, ...groups.flat()].sort(
          (a, b) => a.partNumber - b.partNumber,
        );
        if (
          parts.length !== count ||
          parts.some((p, i) => p.partNumber !== i + 1 || !p.etag)
        )
          throw Error("Missing archive parts");
        const obj = await bucket
          .resumeMultipartUpload(key, upload)
          .complete(parts);
        if (obj.size !== size) throw Error("Archive length mismatch");
      },
    );
    return "complete";
  }
}
