/*
 * Shared portfolio rules.
 *
 * The popup and background scripts should depend on this small interface
 * instead of reimplementing fund-specific arithmetic in each view.
 */

var ASSET_TYPES = {
  STOCK: "STOCK",
  FUND: "FUND",
};

function number(value, fallback) {
  var parsed = Number(value);
  return isFinite(parsed) ? parsed : fallback;
}

function positive(value, name) {
  var parsed = number(value, NaN);
  if (!(parsed > 0)) {
    throw new Error(name + " must be greater than zero");
  }
  return parsed;
}

function normalizeInstrument(input) {
  input = input || {};
  var market = String(input.market || "CN").toUpperCase();
  var symbol = String(input.symbol || input.code || "").trim();
  if (!symbol) {
    throw new Error("instrument symbol is required");
  }

  var assetType = String(input.assetType || ASSET_TYPES.STOCK).toUpperCase();
  var id = input.id || (assetType + "." + market + "." + symbol);
  return {
    id: id,
    assetType: assetType,
    market: market,
    symbol: symbol,
    name: input.name || "",
    currency: input.currency || "CNY",
  };
}

function normalizeTransaction(input) {
  input = input || {};
  var side = String(input.side || "").toUpperCase();
  if (side !== "BUY" && side !== "SELL") {
    throw new Error("transaction side must be BUY or SELL");
  }
  return {
    id: input.id || null,
    instrumentId: input.instrumentId,
    side: side,
    quantity: positive(input.quantity, "quantity"),
    price: positive(input.price, "price"),
    fee: Math.max(0, number(input.fee, 0)),
    tradedAt: input.tradedAt || new Date().toISOString(),
  };
}

function calculatePosition(transactions, quote, openingPosition) {
  openingPosition = openingPosition || {};
  var quantity = Math.max(0, number(openingPosition.quantity, 0));
  var openingAverageCost = Math.max(0, number(openingPosition.averageCost, 0));
  var costBasis = quantity * openingAverageCost;
  var realizedPnl = 0;
  var normalized = (transactions || []).map(normalizeTransaction);

  normalized.forEach(function (transaction) {
    var gross = transaction.quantity * transaction.price;
    if (transaction.side === "BUY") {
      quantity += transaction.quantity;
      costBasis += gross + transaction.fee;
      return;
    }

    if (transaction.quantity > quantity) {
      throw new Error("sell quantity exceeds current position");
    }
    var averageCost = quantity === 0 ? 0 : costBasis / quantity;
    quantity -= transaction.quantity;
    costBasis -= averageCost * transaction.quantity;
    realizedPnl += gross - transaction.fee - averageCost * transaction.quantity;
  });

  var last = quote && number(quote.last, NaN);
  var marketValue = isFinite(last) ? last * quantity : null;
  var unrealizedPnl = marketValue === null ? null : marketValue - costBasis;
  var totalPnl = unrealizedPnl === null ? realizedPnl : realizedPnl + unrealizedPnl;

  return {
    quantity: quantity,
    costBasis: costBasis,
    averageCost: quantity === 0 ? 0 : costBasis / quantity,
    marketValue: marketValue,
    realizedPnl: realizedPnl,
    unrealizedPnl: unrealizedPnl,
    totalPnl: totalPnl,
  };
}

function calculateDailyPnl(position, quote) {
  if (!quote || !isFinite(number(quote.last, NaN)) || !isFinite(number(quote.prevClose, NaN))) {
    return null;
  }
  return (quote.last - quote.prevClose) * position.quantity;
}

function calculatePortfolioSummary(items) {
  var summary = {
    marketValue: 0,
    costBasis: 0,
    dailyPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    staleCount: 0,
    itemCount: 0,
  };

  (items || []).forEach(function (item) {
    if (!item || !item.position) return;
    summary.itemCount += 1;
    summary.costBasis += number(item.position.costBasis, 0);
    summary.realizedPnl += number(item.position.realizedPnl, 0);
    summary.unrealizedPnl += number(item.position.unrealizedPnl, 0);
    summary.marketValue += number(item.position.marketValue, 0);
    var daily = calculateDailyPnl(item.position, item.quote);
    if (daily !== null) summary.dailyPnl += daily;
    if (item.quote && item.quote.isStale) summary.staleCount += 1;
  });

  summary.totalPnl = summary.realizedPnl + summary.unrealizedPnl;
  return summary;
}

module.exports = {
  ASSET_TYPES: ASSET_TYPES,
  normalizeInstrument: normalizeInstrument,
  normalizeTransaction: normalizeTransaction,
  calculatePosition: calculatePosition,
  calculateDailyPnl: calculateDailyPnl,
  calculatePortfolioSummary: calculatePortfolioSummary,
};
