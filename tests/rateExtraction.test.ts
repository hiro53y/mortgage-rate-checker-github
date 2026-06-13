import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractRate,
  extractRateFromAggregate,
  getRateUrls,
} from "../functions/api/rates.js";

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

  it("rejects review-era rates and fee percentages that are not current variable rates", () => {
    assert.equal(
      extractRate("<p>口コミ 金利種別 変動金利 金 利 0.400%位 借入時期 2019年1月</p>", {
        bankName: "住信SBIネット銀行",
        preferredKeywords: ["変動", "住宅ローン"],
        minExpectedRate: 0.7,
        maxExpectedRate: 1.5,
      }),
      null,
    );
    assert.equal(
      extractRate("<p>住宅ローン 別途借入金額の2.20%(税込)の事務手数料が発生します。</p>", {
        bankName: "広島銀行",
        preferredKeywords: ["住宅ローン", "スーパー住宅ローン"],
        minExpectedRate: 0.7,
        maxExpectedRate: 1.2,
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

  it("uses bounded bank-specific contexts for Hiroshima Bank and SBI Sumishin Net Bank", () => {
    assert.equal(
      extractRateFromAggregate(
        "<article><h1>広島銀行の住宅ローン金利推移</h1><p>年月 変動金利 10年固定 フラット35</p><p>2026/06 0.950% 3.100% 2.710% 2.210%</p><p>2025/09 0.700% 2.300% 1.870% 1.370%</p></article>",
        {
          bankName: "広島銀行",
          preferredKeywords: ["変動", "住宅ローン", "スーパー住宅ローン"],
          minExpectedRate: 0.7,
          maxExpectedRate: 1.2,
        },
      ),
      0.95,
    );
    assert.equal(
      extractRateFromAggregate(
        "<section><h3>住信SBIネット銀行 WEB申込コース 借換 変動金利</h3><p>適用金利 年0.950%</p><p>口コミ 金利 0.400%位</p></section>",
        {
          bankName: "住信SBIネット銀行",
          aggregateAliases: ["住信SBI", "NEOBANK"],
          preferredKeywords: ["借換", "変動", "適用金利"],
          minExpectedRate: 0.7,
          maxExpectedRate: 1.5,
        },
      ),
      0.95,
    );
  });

  it("prefers surface or applicable rates over aggregate effective rates", () => {
    const html = `
      <section>
        <h3>三菱UFJ銀行 住宅ローン（事務手数料型）・変動金利</h3>
        <p>実質金利(手数料込) 1.080%</p>
        <p>表面金利 年0.945%</p>
      </section>
    `;

    assert.equal(
      extractRateFromAggregate(html, {
        bankName: "三菱UFJ銀行",
        preferredKeywords: ["変動", "住宅ローン", "表面金利"],
      }),
      0.945,
    );
  });

  it("extracts bank-specific rates from aggregate pages by aliases", () => {
    const html = `
      <section>
        <h3>住信SBIネット銀行 WEB申込コース 借換 変動金利</h3>
        <p>適用金利 年0.950%</p>
      </section>
      <section>
        <h3>別の銀行 変動金利</h3>
        <p>適用金利 年0.500%</p>
      </section>
    `;

    assert.equal(
      extractRateFromAggregate(html, {
        bankName: "住信SBIネット銀行",
        aggregateAliases: ["住信SBI", "NEOBANK"],
        preferredKeywords: ["借換", "変動", "適用金利"],
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

  it("includes the revised official pages for Hiroshima Bank and SBI Sumishin Net Bank", () => {
    assert.deepEqual(
      getRateUrls({
        rateUrls: [
          "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
          "https://www.netbk.co.jp/contents/lineup/home-loan/web/kinri/",
        ],
      }),
      [
        "https://www.netbk.co.jp/contents/lp/homeloan/web/re.html",
        "https://www.netbk.co.jp/contents/lineup/home-loan/web/kinri/",
      ],
    );
    assert.ok(
      getRateUrls({
        rateUrls: ["https://www.hirogin.co.jp/service/loan/housing-loan/super/"],
      }).includes("https://www.hirogin.co.jp/service/loan/housing-loan/super/"),
    );
  });
});
