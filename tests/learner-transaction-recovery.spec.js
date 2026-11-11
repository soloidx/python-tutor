import { test, expect } from "./fixtures/catalog.js";

test("a failed transaction cannot mark an uncommitted recovery copy as durable", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { learnerSet, learnerGet, learnerList, learnerTransaction } = await import("/src/learnerStore.js");
    const { preserveLearnerRecord, writeLearnerRecord } = await import("/src/learnerRecovery.js");
    const source = "python-tutor:course-progress:v1:damaged";
    const destination = "python-tutor:course-progress:v1:replacement";
    learnerSet(source, "damaged source");
    const request = navigator.locks.request;
    navigator.locks.request = () => new Promise(() => {});
    preserveLearnerRecord(source, "damaged", "progress", "damaged source", destination);
    navigator.locks.request = request;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "python-tutor:learner-store:v1") throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
    let failed = false;
    try { learnerTransaction(() => writeLearnerRecord(destination, "replacement")); } catch { failed = true; }
    Storage.prototype.setItem = set;
    learnerTransaction(() => {
      writeLearnerRecord(destination, "replacement");
      writeLearnerRecord(destination, "replacement");
    });
    return {
      failed,
      replacement: learnerGet(destination),
      copies: learnerList().filter((key) => key.startsWith("python-tutor:recovery:v1:")).map(learnerGet),
    };
  });
  expect(result.failed).toBe(true);
  expect(result.replacement).toBe("replacement");
  expect(result.copies).toEqual(["damaged source"]);
});

test("a rejected operation cannot write after its transaction ends", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { learnerGet, learnerSet, learnerRevision, performLearnerOperation } = await import("/src/learnerStore.js");
    let rejected = false;
    try {
      await performLearnerOperation({
        id: "rejected",
        revision: learnerRevision(),
        apply: async () => {
          await Promise.resolve();
          learnerSet("late", "escaped");
        },
      });
    } catch (error) {
      rejected = error instanceof TypeError;
    }
    const operation = {
      id: "accepted",
      revision: learnerRevision(),
      changes: [{ key: "accepted", value: "saved" }],
    };
    return {
      rejected,
      late: learnerGet("late"),
      applied: await performLearnerOperation(operation),
      repeated: await performLearnerOperation(operation),
      accepted: learnerGet("accepted"),
    };
  });
  expect(result).toEqual({
    rejected: true,
    late: null,
    applied: { status: "applied" },
    repeated: { status: "already-applied" },
    accepted: "saved",
  });
});
