var portfolio = require("./portfolio");

var CURRENT_SCHEMA_VERSION = 2;

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function legacyFundRecords(fundListM) {
  var watchlists = [];
  var positions = [];
  (Array.isArray(fundListM) ? fundListM : []).forEach(function (fund) {
    if (!fund || !fund.code) return;
    var instrument = portfolio.normalizeInstrument({
      id: "FUND.CN." + fund.code,
      assetType: portfolio.ASSET_TYPES.FUND,
      market: "CN",
      symbol: fund.code,
      name: fund.name || "",
    });
    watchlists.push({
      instrumentId: instrument.id,
      assetType: instrument.assetType,
      order: watchlists.length,
    });
    positions.push({
      instrument: instrument,
      quantity: Number(fund.num) || 0,
      averageCost: Number(fund.cost) || 0,
      transactions: [],
    });
  });
  return { watchlists: watchlists, positions: positions };
}

function migrateStorageConfig(raw) {
  raw = raw || {};
  if (raw.portfolioSchemaVersion >= CURRENT_SCHEMA_VERSION && raw.portfolio) {
    var current = copy(raw);
    var latestFunds = legacyFundRecords(raw.fundListM);
    var watchlists = Array.isArray(current.portfolio.watchlists) ? current.portfolio.watchlists : [];
    var positions = Array.isArray(current.portfolio.positions) ? current.portfolio.positions : [];
    var nonFunds = watchlists.filter(function (item) {
      return item.assetType !== portfolio.ASSET_TYPES.FUND;
    });
    var nonFundPositions = positions.filter(function (item) {
      return item.instrument && item.instrument.assetType !== portfolio.ASSET_TYPES.FUND;
    });
    current.portfolio.watchlists = latestFunds.watchlists.concat(nonFunds);
    current.portfolio.positions = latestFunds.positions.concat(nonFundPositions);
    return current;
  }

  var migrated = copy(raw);

  var legacyFunds = Array.isArray(raw.fundListM) ? raw.fundListM : [];
  var legacyRecords = legacyFundRecords(legacyFunds);

  migrated.portfolioSchemaVersion = CURRENT_SCHEMA_VERSION;
  migrated.portfolio = {
    watchlists: legacyRecords.watchlists,
    positions: legacyRecords.positions,
    transactions: [],
  };
  migrated.legacy = {
    fundListM: copy(legacyFunds),
    RealtimeFundcode: raw.RealtimeFundcode || null,
    RealtimeIndcode: raw.RealtimeIndcode || null,
  };
  return migrated;
}

module.exports = {
  CURRENT_SCHEMA_VERSION: CURRENT_SCHEMA_VERSION,
  migrateStorageConfig: migrateStorageConfig,
};
