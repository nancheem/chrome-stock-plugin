var portfolio = require("./portfolio");

function marketCode(market) {
  var value = String(market || "").toUpperCase();
  if (value === "SH" || value === "SSE" || value === "1") return "1";
  if (value === "SZ" || value === "SZSE" || value === "0") return "0";
  return value;
}

function toSecid(instrument) {
  instrument = portfolio.normalizeInstrument(instrument);
  return marketCode(instrument.market) + "." + instrument.symbol;
}

function buildQuoteUrl(instruments) {
  var secids = (instruments || []).map(toSecid).join(",");
  return "https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f5,f6,f12,f13,f14,f60,f124&secids=" + secids;
}

function buildSearchUrl(query) {
  return "https://searchapi.eastmoney.com/api/suggest/get?input=" + encodeURIComponent(query || "") + "&type=14";
}

function normalizeSearchResult(raw) {
  raw = raw || {};
  var market = marketCode(raw.MARKET || raw.f13 || raw.MARKET_TYPE);
  return {
    id: "STOCK." + (market === "1" ? "SH" : "SZ") + "." + String(raw.CODE || raw.f12 || ""),
    assetType: portfolio.ASSET_TYPES.STOCK,
    market: market === "1" ? "SH" : "SZ",
    symbol: String(raw.CODE || raw.f12 || ""),
    name: raw.NAME || raw.f14 || "",
  };
}

function buildIntradayUrl(instrument) {
  return "https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=" + toSecid(instrument) + "&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f53,f56,f58";
}

function quoteTimestamp(value, fallback) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && isFinite(value)) {
    var millis = value < 100000000000 ? value * 1000 : value;
    var date = new Date(millis);
    if (isFinite(date.getTime())) return date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    var parsed = new Date(value);
    if (isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return fallback || new Date().toISOString();
}

function normalizeQuote(raw, now) {
  raw = raw || {};
  var market = marketCode(raw.f13);
  var symbol = String(raw.f12 || "");
  var quote = {
    instrumentId: "STOCK." + (market === "1" ? "SH" : "SZ") + "." + symbol,
    symbol: symbol,
    market: market === "1" ? "SH" : "SZ",
    name: raw.f14 || "",
    last: Number(raw.f2), // latest price
    changePct: Number(raw.f3), // percentage change
    change: Number(raw.f4), // absolute change
    prevClose: Number(raw.f60), // previous close
    volume: Number(raw.f5),
    amount: Number(raw.f6),
    timestamp: quoteTimestamp(raw.f124, now),
    isStale: false,
  };
  return quote;
}

function markStale(quote, now, maxAgeMs) {
  var result = Object.assign({}, quote);
  var timestamp = new Date(quote.timestamp).getTime();
  var current = now instanceof Date ? now.getTime() : new Date(now || Date.now()).getTime();
  var age = current - timestamp;
  result.isStale = !isFinite(timestamp) || age < 0 || age > (maxAgeMs || 120000);
  return result;
}

module.exports = {
  toSecid: toSecid,
  buildQuoteUrl: buildQuoteUrl,
  buildSearchUrl: buildSearchUrl,
  normalizeSearchResult: normalizeSearchResult,
  buildIntradayUrl: buildIntradayUrl,
  normalizeQuote: normalizeQuote,
  markStale: markStale,
};
