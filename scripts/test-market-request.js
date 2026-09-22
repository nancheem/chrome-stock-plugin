var assert = require("assert");
var marketRequest = require("../src/domain/marketRequest");

var trendUrl = "https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=1.000001";
var trendCandidates = marketRequest.getRequestCandidates(trendUrl);
assert.strictEqual(trendCandidates.length, 2);
assert.ok(trendCandidates[0].indexOf("push2.eastmoney.com") !== -1);
assert.ok(trendCandidates[1].indexOf("push2delay.eastmoney.com") !== -1);
assert.ok(trendCandidates[0].indexOf("_=") !== -1);

var klineUrl = "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000001";
var klineCandidates = marketRequest.getRequestCandidates(klineUrl);
assert.strictEqual(klineCandidates.length, 1);
assert.ok(klineCandidates[0].indexOf("push2his.eastmoney.com") !== -1);

assert.doesNotThrow(function () {
  marketRequest.validateResponse(trendUrl, { rc: 0, code: 0, data: { trends: ["2026-09-22 09:30,1,2,3"] } });
});
assert.throws(function () {
  marketRequest.validateResponse(trendUrl, { rc: 0, code: 0, data: { trends: [] } });
}, /空数据/);
assert.doesNotThrow(function () {
  marketRequest.validateResponse(klineUrl, { rc: 0, code: 0, data: { klines: ["2026-09-22,1,2,3,0,10"] } });
});

console.log("market request tests passed");
