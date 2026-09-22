# 股票核心迭代基线

本阶段建立股票优先、基金兼容的领域模型，不改变现有基金页面和旧配置读取方式。

## 新接口

- `src/domain/portfolio.js`：统一资产、交易、持仓和组合收益计算。
- `src/domain/storageMigration.js`：将旧的 `fundListM` 配置迁移为版本化 `portfolio` 数据。
- 股票使用 `STOCK.MARKET.SYMBOL` 形式的唯一标识，基金使用 `FUND.CN.CODE`。

## 第一阶段接入顺序

1. `stockMarketAdapter.js` 提供股票搜索、报价和分时 URL/字段归一化。
2. 自选列表读取 `portfolio.watchlists`，基金数据继续从 `legacy.fundListM` 兼容读取。
3. 当前列表暂由弹窗直接调用适配器；下一步再把请求集中到 `background.js`，统一缓存和限流。
4. 增加股票买卖记录入口，再把持仓收益接到统一计算器。
5. 最后替换角标和详情页，避免页面同时维护两套收益算法。

## 存储原则

- `chrome.storage.sync` 只保存自选项、持仓、交易记录和用户设置。
- 最新报价、分时数据放运行时缓存或 `chrome.storage.local`。
- 迁移后保留 `legacy` 快照，确认新页面稳定后再清理旧字段。

## 验证

```text
node scripts/test-stock-domain.js
```
