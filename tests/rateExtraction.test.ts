import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractRate, getRateUrls } from "../functions/api/rates.js";

describe("rate extraction", () => {
  it("prefers mortgage variable-rate context over insurance add-on rates", () => {
    const html = `
      <main>
        <h1>住宅ローン金利</h1>
        <p>がん団信の上乗せ金利は年0.20%です。</p>
        <table>
          <tr><th>借換 変動金利 適用金利</th><td>年0.995%</td></tr>
        </table>
      </main>
    `;

    assert.equal(
      extractRate(html, { preferredKeywords: ["借換", "変動", "住宅ローン"] }),
      0.995,
    );
  });

  it("does not treat placeholders or add-on-only rates as fetched rates", () => {
    assert.equal(
      extractRate("<p>住宅ローン 変動金利 年--%</p>", {
        preferredKeywords: ["変動", "住宅ローン"],
      }),
      null,
    );
    assert.equal(
      extractRate("<p>住宅ローン がん団信の上乗せ金利 年0.20%</p>", {
        preferredKeywords: ["変動", "住宅ローン"],
      }),
      null,
    );
  });

  it("keeps Japanese long vowel marks when scoring mortgage loan context", () => {
    assert.equal(
      extractRate("<p>YCG住宅ローン 融資手数料型3 がん100%込み 下限金利 年0.950%</p>", {
        preferredKeywords: ["住宅ローン", "融資手数料型", "下限"],
      }),
      0.95,
    );
  });

  it("builds rate URL candidates from rateUrls first and keeps rateUrl fallback", () => {
    assert.deepEqual(
      getRateUrls({
        rateUrls: ["https://example.com/rate", "https://example.com/loan"],
        rateUrl: "https://example.com/rate",
      }),
      ["https://example.com/rate", "https://example.com/loan"],
    );
  });
});
