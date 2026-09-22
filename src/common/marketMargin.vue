<template>
  <div class="box margin-box" v-loading="loading" :element-loading-background="darkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)'">
    <div v-if="errorMessage" class="state-message">
      <span>{{ errorMessage }}</span>
      <button class="retry-btn" type="button" @click="getData">重试</button>
    </div>
    <template v-else>
      <div v-if="summary" class="margin-summary">
        昨日融资余额<strong>{{ formatYi(summary.financing) }}亿元</strong>，较前一日
        <span :class="summary.change >= 0 ? 'up' : 'down'">{{ formatChange(summary.change, summary.changeRate) }}</span>；
        融券余额<strong>{{ formatYi(summary.short) }}亿元</strong>，融资融券差额<strong>{{ formatYi(summary.spread) }}亿元</strong>，
        <span>较20日均值{{ summary.financing >= summary.average20 ? '偏高' : '偏低' }}</span>。
      </div>
      <div class="main-echarts" ref="mainCharts"></div>
      <div v-if="summary" class="update-time">数据日期：{{ summary.date }}</div>
    </template>
  </div>
</template>

<script>
let echarts = require("echarts/lib/echarts");
import "./js/customed.js";
import "./js/dark.js";
require("echarts/lib/chart/line");
require("echarts/lib/component/tooltip");
require("echarts/lib/component/legend");

var MARGIN_URL = "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_RZRQ_LSHJ&columns=ALL&source=WEB&sortColumns=DIM_DATE&sortTypes=-1&pageNumber=1&pageSize=60&filter=";

export default {
  name: "marketMargin",
  props: { darkMode: { type: Boolean, default: false } },
  data() {
    return { chartEL: null, myChart: null, loading: false, errorMessage: "", summary: null };
  },
  computed: {
    textColor() { return this.darkMode ? "rgba(255,255,255,0.72)" : "#606266"; },
    axisColor() { return this.darkMode ? "rgba(255,255,255,0.35)" : "#c8c8c8"; },
    splitColor() { return this.darkMode ? "rgba(255,255,255,0.12)" : "#e8e8e8"; },
  },
  mounted() {
    this.initChart();
    this.getData();
    window.addEventListener("resize", this.resizeChart);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.resizeChart);
    if (this.myChart) { this.myChart.dispose(); this.myChart = null; }
  },
  methods: {
    initChart() {
      this.chartEL = this.$refs.mainCharts;
      this.myChart = echarts.init(this.chartEL, this.darkMode ? "dark" : "customed");
    },
    resizeChart() { if (this.myChart) this.myChart.resize(); },
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
      return this.$axios.get(url, { withCredentials: true });
    },
    getData() {
      this.loading = true;
      this.errorMessage = "";
      this.summary = null;
      this.requestJson(MARGIN_URL + "&_=" + new Date().getTime())
        .then((res) => {
          var rows = res && res.data && res.data.result && Array.isArray(res.data.result.data) ? res.data.result.data : [];
          var points = rows.map((row) => ({
            date: String(row.DIM_DATE || "").slice(0, 10),
            financing: Number(row.RZYE),
            short: Number(row.RQYE),
          })).filter((item) => item.date && isFinite(item.financing) && isFinite(item.short)).reverse();
          if (!points.length) throw new Error("融资融券接口返回空数据");
          var latest = points[points.length - 1];
          var previous = points.length > 1 ? points[points.length - 2] : latest;
          var averagePoints = points.slice(Math.max(0, points.length - 20));
          var average20 = averagePoints.reduce((sum, item) => sum + item.financing, 0) / averagePoints.length;
          var change = latest.financing - previous.financing;
          this.summary = {
            date: latest.date, financing: latest.financing, short: latest.short,
            spread: latest.financing - latest.short, change: change,
            changeRate: previous.financing ? (change / previous.financing) * 100 : 0,
            average20: average20,
          };
          this.renderChart(points);
        })
        .catch((error) => {
          this.errorMessage = "行情加载失败：" + (error && error.message ? error.message : "请检查网络后重试");
        })
        .then(() => { this.loading = false; });
    },
    renderChart(points) {
      var dates = points.map((item) => item.date);
      var financing = points.map((item) => item.financing / 100000000);
      var short = points.map((item) => item.short / 100000000);
      this.myChart.setOption({
        animation: false,
        color: ["#1687c9", "#e39b3b"],
        tooltip: {
          trigger: "axis", axisPointer: { type: "cross" },
          formatter: (params) => {
            var html = params[0].axisValue + "<br/>";
            params.forEach((item) => { html += item.marker + " " + item.seriesName + "：<strong>" + Number(item.value).toFixed(2) + "亿元</strong><br/>"; });
            return html;
          },
        },
        legend: { top: 2, left: "center", data: ["融资余额", "融券余额"], textStyle: { color: this.textColor, fontSize: 11 } },
        grid: { left: 48, right: 48, top: 34, bottom: 32, containLabel: true },
        xAxis: {
          type: "category", data: dates, boundaryGap: false,
          axisLine: { lineStyle: { color: this.axisColor } },
          axisLabel: { color: this.textColor, fontSize: 10, interval: Math.max(0, Math.floor(dates.length / 6) - 1), formatter: (value) => value.slice(5) },
          splitLine: { show: false },
        },
        yAxis: [
          { type: "value", name: "融资余额", position: "left", scale: true, nameTextStyle: { color: this.textColor, fontSize: 11 }, axisLabel: { color: this.textColor, fontSize: 10, formatter: "{value}亿" }, axisLine: { show: true, lineStyle: { color: "#1687c9" } }, splitLine: { lineStyle: { color: this.splitColor } } },
          { type: "value", name: "融券余额", position: "right", scale: true, nameTextStyle: { color: this.textColor, fontSize: 11 }, axisLabel: { color: this.textColor, fontSize: 10, formatter: "{value}亿" }, axisLine: { show: true, lineStyle: { color: "#e39b3b" } }, splitLine: { show: false } },
        ],
        series: [
          { name: "融资余额", type: "line", yAxisIndex: 0, data: financing, smooth: true, showSymbol: false, lineStyle: { width: 2 } },
          { name: "融券余额", type: "line", yAxisIndex: 1, data: short, smooth: true, showSymbol: false, lineStyle: { width: 2 } },
        ],
      }, true);
    },
    formatYi(value) { return (Number(value || 0) / 100000000).toFixed(2); },
    formatChange(change, rate) {
      var prefix = change >= 0 ? "+" : "";
      return prefix + this.formatYi(change) + "亿元（" + prefix + Number(rate || 0).toFixed(2) + "%）";
    },
  },
};
</script>

<style lang="scss" scoped>
.box { width: 100%; min-height: 286px; }
.margin-summary { text-align: left; color: #606266; font-size: 12px; line-height: 20px; padding: 4px 8px 0; strong { margin: 0 3px; color: #303133; } .up { color: #f56c6c; } .down { color: #4eb61b; } }
.main-echarts { width: 100%; height: 224px; }
.update-time { color: #909399; text-align: right; font-size: 11px; padding: 0 8px 3px; }
.state-message { min-height: 250px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #909399; font-size: 12px; }
.retry-btn { cursor: pointer; background: #fff; border: 1px solid #dcdfe6; border-radius: 3px; color: #303133; font-size: 12px; padding: 4px 8px; }
</style>
