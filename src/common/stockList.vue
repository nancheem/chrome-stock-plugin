<template>
  <div class="stock-list" :class="darkMode ? 'darkMode' : ''" v-loading="loading">
    <div class="stock-toolbar">
      <input
        v-model="inputCode"
        class="btn stock-input"
        type="text"
        placeholder="输入股票代码，如 SZ.000001"
        @keyup.enter="addStock"
      />
      <input class="btn primary" type="button" value="添加股票" @click="addStock" />
      <input class="btn" type="button" value="刷新" @click="refresh" />
    </div>
    <p class="tips">第一阶段支持沪深 A 股行情；报价时间过旧时会标记为已过期。</p>
    <table v-if="rows.length" class="stock-table">
      <thead>
        <tr>
          <th class="align-left">股票（{{ rows.length }}）</th>
          <th>最新价</th>
          <th>涨跌幅</th>
          <th>行情时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.instrument.id">
          <td class="align-left">{{ row.quote.name || row.instrument.symbol }}（{{ row.instrument.market }}）</td>
          <td>{{ display(row.quote.last) }}</td>
          <td :class="row.quote.changePct >= 0 ? 'up' : 'down'">{{ display(row.quote.changePct) }}%</td>
          <td>{{ row.quote.isStale ? "已过期" : row.quote.timestamp }}</td>
          <td><input class="btn red" type="button" value="删除" @click="removeStock(row.instrument.id)" /></td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">还没有股票，输入代码后添加。</p>
  </div>
</template>

<script>
const stockMarket = require("../domain/stockMarketAdapter");
const migration = require("../domain/storageMigration");

export default {
  name: "stockList",
  props: {
    darkMode: { type: Boolean, default: false },
  },
  data() {
    return {
      inputCode: "",
      rows: [],
      config: null,
      loading: false,
      staleTimer: null,
    };
  },
  mounted() {
    this.load();
    this.staleTimer = setInterval(() => {
      this.rows = this.rows.map((row) => ({
        instrument: row.instrument,
        quote: stockMarket.markStale(row.quote, new Date(), 120000),
      }));
    }, 30000);
  },
  beforeDestroy() {
    clearInterval(this.staleTimer);
  },
  methods: {
    display(value) {
      return isFinite(Number(value)) ? Number(value).toFixed(2) : "--";
    },
    parseInstrument(value) {
      var raw = String(value || "").trim().toUpperCase().replace(":", ".");
      var parts = raw.split(".");
      var market = parts.length > 1 ? parts[0] : raw.indexOf("6") === 0 ? "SH" : "SZ";
      var symbol = parts.length > 1 ? parts[1] : parts[0];
      if (!/^\d{6}$/.test(symbol) || ["SH", "SZ"].indexOf(market) === -1) {
        throw new Error("请输入六位沪深股票代码");
      }
      return {
        id: "STOCK." + market + "." + symbol,
        assetType: "STOCK",
        market: market,
        symbol: symbol,
      };
    },
    load() {
      chrome.storage.sync.get(null, (raw) => {
        this.config = migration.migrateStorageConfig(raw);
        this.saveConfig(() => this.refresh());
      });
    },
    saveConfig(callback) {
      chrome.storage.sync.set(this.config, callback || function() {});
    },
    stockItems() {
      return this.config && this.config.portfolio
        ? this.config.portfolio.watchlists.filter((item) => item.assetType === "STOCK")
        : [];
    },
    addStock() {
      var instrument;
      try {
        instrument = this.parseInstrument(this.inputCode);
      } catch (error) {
        this.$message.error(error.message);
        return;
      }
      var items = this.stockItems();
      if (items.some((item) => item.instrumentId === instrument.id)) {
        this.$message.info("这只股票已经在列表中");
        return;
      }
      this.config.portfolio.watchlists.push({
        instrumentId: instrument.id,
        assetType: "STOCK",
        order: this.config.portfolio.watchlists.length,
        instrument: instrument,
      });
      this.config.portfolio.positions.push({
        instrument: instrument,
        quantity: 0,
        averageCost: 0,
        transactions: [],
      });
      this.inputCode = "";
      this.saveConfig(() => this.refresh());
    },
    removeStock(id) {
      this.config.portfolio.watchlists = this.config.portfolio.watchlists.filter((item) => item.instrumentId !== id);
      this.config.portfolio.positions = this.config.portfolio.positions.filter((item) => item.instrument.id !== id);
      this.config.portfolio.transactions = (this.config.portfolio.transactions || []).filter((item) => item.instrumentId !== id);
      this.saveConfig(() => this.refresh());
    },
    refresh() {
      var items = this.stockItems();
      if (!items.length) {
        this.rows = [];
        return;
      }
      this.loading = true;
      var instruments = items.map((item) => item.instrument || {
        id: item.instrumentId,
        assetType: "STOCK",
        market: item.instrumentId.split(".")[1],
        symbol: item.instrumentId.split(".")[2],
      });
      this.$axios.get(stockMarket.buildQuoteUrl(instruments)).then((response) => {
        var diff = response.data && response.data.data && response.data.data.diff || [];
        var quotes = diff.map((item) => stockMarket.markStale(stockMarket.normalizeQuote(item), new Date(), 120000));
        this.rows = instruments.map((instrument) => ({
          instrument: instrument,
          quote: quotes.filter((quote) => quote.instrumentId === instrument.id)[0] || {
            name: instrument.name,
            last: NaN,
            changePct: NaN,
            timestamp: "--",
            isStale: true,
          },
        }));
      }).catch(() => {
        this.$message.error("股票行情获取失败");
      }).then(() => {
        this.loading = false;
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.stock-list { padding: 8px 0; }
.stock-toolbar { display: flex; align-items: center; margin-bottom: 8px; }
.stock-input { width: 220px; }
.stock-table { width: 100%; border-collapse: collapse; }
.stock-table th, .stock-table td { height: 30px; padding: 0 8px; text-align: right; }
.stock-table tr:nth-child(even) { background: #f1f1f1; }
.empty { text-align: center; padding: 30px 0; color: #909399; }
.darkMode .stock-table tr:nth-child(even) { background: rgba(255, 255, 255, 0.05); }
</style>
