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
