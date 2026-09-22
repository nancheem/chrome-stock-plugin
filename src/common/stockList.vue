<template>
  <div class="stock-list" :class="darkMode ? 'darkMode' : ''" v-loading="loading">
    <div v-if="isEdit" class="input-row">
      <span>添加新股票:</span>
      <input
        v-model="inputCode"
        class="btn stock-input"
        type="text"
        placeholder="请输入股票代码，如 000001 或 SZ.000001"
        @keyup.enter="addStock"
      />
      <input class="btn" type="button" value="确定" @click="addStock" />
    </div>
    <div class="table-row" style="min-height:160px">
    <table class="stock-table">
      <thead>
        <tr>
          <th class="align-left">股票名称（{{ rows.length }}）</th>
          <th v-if="isEdit">股票代码</th>
          <th>最新价</th>
          <th>涨跌幅</th>
          <th v-if="!isEdit">更新时间</th>
          <th v-if="isEdit">删除</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.instrument.id"
          :class="isEdit ? '' : 'stock-row-clickable'"
          @click.stop="!isEdit && openDetail(row)"
        >
          <td
            :class="isEdit ? 'fundName-noclick align-left' : 'fundName align-left'"
            :title="row.quote.name || row.instrument.symbol"
          >{{ row.quote.name || row.instrument.symbol }}</td>
          <td v-if="isEdit">{{ row.instrument.symbol }}</td>
          <td>{{ display(row.quote.last) }}</td>
          <td :class="row.quote.changePct >= 0 ? 'up' : 'down'">{{ display(row.quote.changePct) }}%</td>
          <td v-if="!isEdit">{{ formatTime(row.quote.timestamp, row.quote.isStale) }}</td>
          <td v-if="isEdit"><input class="btn red edit" type="button" value="✖" @click="removeStock(row.instrument.id)" /></td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rows.length" class="empty">暂无股票，请点击“编辑”后添加。</p>
    </div>
  </div>
</template>

<script>
const stockMarket = require("../domain/stockMarketAdapter");
const migration = require("../domain/storageMigration");

export default {
  name: "stockList",
  props: {
    darkMode: { type: Boolean, default: false },
    isEdit: { type: Boolean, default: false },
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
    formatTime(value, stale) {
      if (stale) return "已过期";
      var date = new Date(value);
      if (!isFinite(date.getTime())) return "--";
      return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
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
    openDetail(row) {
      this.$emit("open-detail", row);
    },
    requestJson(url) {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: "fetchJson", url: url }, (response) => {
            if (chrome.runtime.lastError || !response || !response.ok) {
              reject(new Error((response && response.error) || "后台行情请求失败"));
              return;
            }
            resolve({ data: response.data });
          });
        });
      }
      return this.$axios.get(url);
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
      this.requestJson(stockMarket.buildQuoteUrl(instruments)).then((response) => {
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
.stock-list { padding: 0; }
.input-row { text-align: center; margin-top: 10px; }
.table-row { max-height: 425px; min-height: 160px; overflow-y: auto; }
.stock-input { width: 270px; }
.stock-table { width: 100%; border-collapse: collapse; }
.stock-table th { padding: 8px 6px; }
.stock-table td { padding: 6px 6px 5px; }
.stock-table th, .stock-table td { height: 30px; text-align: right; }
.stock-table tr:nth-child(even) { background: #f1f1f1; }
.stock-table .align-left { text-align: left; }
.fundName { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; user-select: none; }
.fundName-noclick { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fundName:hover { color: #409eff; }
.stock-row-clickable { cursor: pointer; }
.up { color: #f56c6c; font-weight: bold; }
.down { color: #4eb61b; font-weight: bold; }
.empty { margin: 0; text-align: center; padding: 30px 0; color: #909399; }
.darkMode .stock-table tr:nth-child(even) { background: rgba(255, 255, 255, 0.05); }
</style>
