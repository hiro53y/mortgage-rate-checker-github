import assert from "node:assert/strict";
import test from "node:test";
import { isRefreshAuthorized } from "../worker/src/index.js";

function refreshRequest(token?: string): Request {
  const headers = token ? { "x-refresh-token": token } : undefined;
  return new Request("https://worker.invalid/api/rates/refresh", {
    method: "POST",
    headers,
  });
}

test("v12: REFRESH_TOKEN未設定時は手動refreshを拒否する", () => {
  assert.equal(isRefreshAuthorized(refreshRequest(), {}), false);
});

test("v12: 誤ったrefresh tokenを拒否する", () => {
  assert.equal(
    isRefreshAuthorized(refreshRequest("wrong-token"), { REFRESH_TOKEN: "correct-token" }),
    false,
  );
});

test("v12: 一致するrefresh tokenだけを許可する", () => {
  assert.equal(
    isRefreshAuthorized(refreshRequest("correct-token"), { REFRESH_TOKEN: "correct-token" }),
    true,
  );
});
