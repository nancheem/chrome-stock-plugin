var assert = require("assert");
var portfolio = require("../src/domain/portfolio");
var migration = require("../src/domain/storageMigration");
var stockMarket = require("../src/domain/stockMarketAdapter");

var position = portfolio.calculatePosition([
  { side: "BUY", quantity: 100, price: 10, fee: 1 },
  { side: "BUY", quantity: 100, price: 12, fee: 1 },
  { side: "SELL", quantity: 50, price: 13, fee: 1 },
], { last: 14, prevClose: 13 });

assert.strictEqual(position.quantity, 150);
assert.strictEqual(position.costBasis, 1651.5);
assert.strictEqual(position.averageCost, 1651.5 / 150);
assert.strictEqual(position.realizedPnl, 98.5);
assert.strictEqual(position.marketValue, 2100);
assert.strictEqual(position.unrealizedPnl, 448.5);
assert.strictEqual(portfolio.calculateDailyPnl(position, { last: 14, prevClose: 13 }), 150);

var migrated = migration.migrateStorageConfig({
  fundListM: [{ code: "000001", num: 10, cost: 1.2 }],
  RealtimeFundcode: "000001",
  darkMode: true,
});
assert.strictEqual(migrated.portfolioSchemaVersion, 2);
assert.strictEqual(migrated.portfolio.positions[0].instrument.assetType, "FUND");
assert.strictEqual(migrated.portfolio.positions[0].instrument.id, "FUND.CN.000001");
assert.strictEqual(migrated.legacy.RealtimeFundcode, "000001");
assert.strictEqual(migrated.darkMode, true);
var refreshed = migration.migrateStorageConfig({
  portfolioSchemaVersion: 2,
  fundListM: [{ code: "000002", num: 20, cost: 2.5 }],
  portfolio: {
    watchlists: [{ instrumentId: "STOCK.SZ.000001", assetType: "STOCK" }],
    positions: [{ instrument: { id: "STOCK.SZ.000001", assetType: "STOCK" }, quantity: 0, averageCost: 0 }],
    transactions: [],
  },
});
assert.strictEqual(refreshed.portfolio.watchlists.length, 2);
assert.strictEqual(refreshed.portfolio.positions[0].instrument.id, "FUND.CN.000002");
assert.strictEqual(refreshed.portfolio.positions[0].quantity, 20);

var quote = stockMarket.normalizeQuote({
  f2: "12.35",
  f3: "2.07",
  f4: "0.25",
  f60: "12.10",
  f5: "1000",
  f6: "12350",
  f12: "000001",
  f13: "0",
  f14: "平安银行",
  f124: 1790042400,
}, "2026-09-22T02:00:00.000Z");
assert.strictEqual(stockMarket.toSecid({ market: "SZ", symbol: "000001", assetType: "STOCK" }), "0.000001");
assert.ok(stockMarket.buildSearchUrl("平安银行").indexOf(encodeURIComponent("平安银行")) !== -1);
assert.strictEqual(stockMarket.normalizeSearchResult({ Code: "600900", Name: "长江电力", MktNum: "1" }).id, "STOCK.SH.600900");
assert.strictEqual(stockMarket.normalizeSearchResult({ Code: "000001", Name: "平安银行", MktNum: "0" }).id, "STOCK.SZ.000001");
assert.ok(stockMarket.buildIntradayUrl({ market: "SZ", symbol: "000001", assetType: "STOCK" }).indexOf("secid=0.000001") !== -1);
assert.ok(stockMarket.buildKlineUrl({ market: "SH", symbol: "600000", assetType: "STOCK" }, "102").indexOf("klt=102") !== -1);
assert.strictEqual(quote.instrumentId, "STOCK.SZ.000001");
assert.strictEqual(quote.last, 12.35);
assert.strictEqual(quote.prevClose, 12.1);
assert.strictEqual(stockMarket.markStale(quote, "2026-09-22T02:00:30.000Z", 120000).isStale, false);
assert.strictEqual(stockMarket.markStale(quote, "2026-09-22T03:00:00.000Z", 120000).isStale, true);

var openingPosition = portfolio.calculatePosition(
  [{ side: "SELL", quantity: 50, price: 13, fee: 1 }],
  { last: 14, prevClose: 13 },
  { quantity: 100, averageCost: 10 }
);
assert.strictEqual(openingPosition.quantity, 50);
assert.strictEqual(openingPosition.costBasis, 500);
assert.strictEqual(openingPosition.realizedPnl, 149);

console.log("stock domain tests passed");
