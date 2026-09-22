var DELAY_HOST = "push2delay.eastmoney.com";

function isTrendUrl(url) {
  return /\/api\/qt\/stock\/trends2\/get(?:\?|$)/.test(url || "");
}

function isQuoteUrl(url) {
  return /\/api\/qt\/ulist\.np\/get(?:\?|$)/.test(url || "");
}

function isKlineUrl(url) {
  return /\/api\/qt\/stock\/kline\/get(?:\?|$)/.test(url || "");
}

function isMarketUrl(url) {
  return isTrendUrl(url) || isQuoteUrl(url) || isKlineUrl(url);
}

function replaceHost(url, host) {
  return String(url || "").replace(/^(https?:\/\/)[^/]+/, "$1" + host);
}

function withCacheBust(url) {
  var value = String(url || "");
  if (!isMarketUrl(value) || /(?:\?|&)_[^=]+=/.test(value)) {
    return value;
  }
  return value + (value.indexOf("?") === -1 ? "?" : "&") + "_=" + Date.now();
}

function unique(values) {
  return values.filter(function (value, index) {
    return values.indexOf(value) === index;
  });
}

// trends2 和实时报价支持 push2delay 兜底；东财历史 K 线的 delay 域可能返回空数组，
// 因此 K 线只重试原始 push2his 地址，避免把“空数据”误判成有效降级结果。
function getRequestCandidates(url) {
  var primary = withCacheBust(url);
  if (!isTrendUrl(primary) && !isQuoteUrl(primary)) {
    return [primary];
  }
  return unique([primary, replaceHost(primary, DELAY_HOST)]);
}

function validateResponse(url, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("响应不是有效 JSON");
  }

  if (Object.prototype.hasOwnProperty.call(payload, "rc") && Number(payload.rc) !== 0) {
    throw new Error("行情接口 rc=" + payload.rc + (payload.message ? " " + payload.message : ""));
  }
  if (Object.prototype.hasOwnProperty.call(payload, "code") && Number(payload.code) !== 0) {
    throw new Error("行情接口 code=" + payload.code + (payload.message ? " " + payload.message : ""));
  }

  var data = payload.data;
  if (isTrendUrl(url) && (!data || !Array.isArray(data.trends) || data.trends.length === 0)) {
    throw new Error("分时接口返回空数据");
  }
  if (isQuoteUrl(url) && (!data || !Array.isArray(data.diff) || data.diff.length === 0)) {
    throw new Error("实时行情接口返回空数据");
  }
  if (isKlineUrl(url) && (!data || !Array.isArray(data.klines) || data.klines.length === 0)) {
    throw new Error("K线接口返回空数据");
  }
  return payload;
}

module.exports = {
  DELAY_HOST: DELAY_HOST,
  isMarketUrl: isMarketUrl,
  getRequestCandidates: getRequestCandidates,
  validateResponse: validateResponse,
};
