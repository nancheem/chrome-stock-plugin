<template>
  <div id="app" class="container" :class="containerClass">
    <div>
      <ul class="setting-list">
        <li>
          <div class="list-title">主题与页面设置</div>
          <div class="select-row">
            <el-switch
              v-model="darkMode"
              @change="changeDarkMode"
              active-color="#484848"
              inactive-color="#13ce66"
              inactive-text="标准模式"
              active-text="暗色模式"
            ></el-switch>
          </div>
          <div class="select-row">
            <el-switch
              v-model="normalFontSize"
              @change="changeFontSize"
              inactive-text="迷你字号"
              active-text="标准字号"
            ></el-switch>
          </div>
        </li>
        <li>
          <div class="list-title">股票行情设置</div>
          <div class="select-row">
            <span>交易时段自动刷新</span>
            <el-switch
              v-model="isLiveUpdate"
              @change="changeOption($event, 'isLiveUpdate')"
            ></el-switch>
          </div>
          <p>开启后，首页会在交易时段自动刷新自选股票行情；分时、日、周、月、年 K 线可点击股票名称查看。</p>
        </li>
        <li>
          <div class="list-title">股票配置管理</div>
          <div style="padding:8px 0 10px">
            <input class="btn" type="button" value="导出配置文件" @click="exportConfig" />
            <a
              class="exportBtn"
              ref="configMsg"
              :href="configHref"
              download="自选股票助手配置文件.json"
            ></a>
            <a href="javascript:;" class="uploadFile btn"
              >导入配置文件
              <input ref="importInput" type="file" accept="application/json" @change="importInput" />
            </a>
            <input class="btn" type="button" value="导入导出文本" @click="openConfigBox" />
          </div>
          <p>配置文件包含自选股票、指数卡片和页面设置，可用于浏览器之间迁移或备份。</p>
        </li>
        <li>
          <div class="list-title">关于插件</div>
          <p style="line-height:34px">
            当前插件版本：v{{ version }}
            <input
              class="btn"
              type="button"
              value="更新日志"
              @click="changelog"
            />
            <input
              class="btn"
              type="button"
              value="插件主页"
              @click="openHomePage"
            />
          </p>
          <p style="line-height:34px">
            电报群：https://t.me/choose_funds_chat
            <input class="btn" type="button" value="点击跳转" @click="openTG" />
          </p>
          <change-log
            @close="closeChangelog"
            :darkMode="darkMode"
            ref="changelog"
            :top="20"
          ></change-log>
          <config-box
            @success="successInput"
            :darkMode="darkMode"
            ref="configBox"
            :top="40"
          >
          </config-box>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import changeLog from "../common/changeLog";
import configBox from "../common/configBox";
const { version } = require("../../package.json");
export default {
  components: {
    changeLog,
    configBox,
  },
  data() {
    return {
      configHref: null,
      darkMode: false,
      isLiveUpdate: false,
      changelogShadow: false,
      normalFontSize: false,
      version,
    };
  },
  mounted() {
    this.initOption();
  },
  watch: {},
  computed: {
    containerClass() {
      if (this.darkMode) {
        return "darkMode";
      }
    },
  },
  methods: {
    changelog() {
      this.changelogShadow = true;
      this.$refs.changelog.init();
    },
    closeChangelog() {
      this.changelogShadow = false;
    },
    changeOption(val, type, sendMessage) {
      chrome.storage.sync.set(
        {
          [type]: val,
        },
        () => {
          this[type] = val;
          if (sendMessage) {
            chrome.runtime.sendMessage({
              type: "refreshOption",
              data: { type: type, value: val },
            });
          }
        }
      );
    },
    initOption() {
      chrome.storage.sync.get(
        ["darkMode", "normalFontSize", "isLiveUpdate"],
        (res) => {
          this.darkMode = res.darkMode === true;
          this.normalFontSize = res.normalFontSize === true;
          this.isLiveUpdate = res.isLiveUpdate === true;
        }
      );
    },
    exportConfig() {
      chrome.storage.sync.get(null, (res) => {
        delete res.holiday;
        this.configHref = "data:text/plain," + JSON.stringify(res);
        setTimeout(() => {
          this.$refs["configMsg"].click();
        }, 200);
      });
    },
    importInput(e) {
      let files = e.target.files;
      if (!files || !files.length) {
        throw new Error("No files");
      }

      let reader = new FileReader();
      reader.onload = (event) => {
        try {
          let config = JSON.parse(event.target.result);
          chrome.storage.sync.set(config, (val) => {
            this.initOption();
            chrome.runtime.sendMessage({ type: "refresh" });
            this.$message({
              message: "恭喜,导入配置成功！",
              type: "success",
              center: true,
            });
            this.$refs.importInput.value = null;
          });
        } catch (e) {
          this.$message({
            message: "导入失败！",
            type: "error",
            center: true,
          });
        }
      };
      reader.readAsText(files[0]);
    },
    successInput() {
      this.initOption();
      chrome.runtime.sendMessage({ type: "refresh" });
    },
    openConfigBox() {
      this.$refs.configBox.init();
    },
    openGithub() {
      window.open("https://github.com/nancheem/chrome-stock-plugin");
    },
    openTG() {
      window.open("https://t.me/choose_funds_chat");
    },
    openHomePage() {
      window.open("https://github.com/nancheem/chrome-stock-plugin");
    },
    changeDarkMode() {
      chrome.storage.sync.set({
        darkMode: this.darkMode,
      });
    },
    changeFontSize() {
      chrome.storage.sync.set({
        normalFontSize: this.normalFontSize,
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.container {
  min-width: 630px;
  min-height: 520px;
  text-align: center;
  padding: 15px 0;
  font-size: 13px;
  font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}

.setting-list {
  width: 600px;
  margin: 0 auto;
  text-align: left;
  padding: 0 10px 10px;
  border-radius: 8px;
}

.setting-list li {
  list-style: none;
  font-size: 16px;
  border-bottom: 1px solid #dddddd;
  padding: 10px 0;
}

.setting-list li p {
  margin: 0;
  font-size: 14px;
  color: #999999;
}

.list-title {
  min-height: 34px;
  line-height: 34px;
  font-weight: bold;
}

.select-row {
  line-height: 35px;
  padding-left: 20px;
  & > span {
    display: inline-block;
    width: 120px;
    margin-right: 3px;
    text-align: right;
  }
  input,
  label {
    cursor: pointer;
  }

  .el-radio {
    margin-right: 0;
  }
}

.btn {
  display: inline-block;
  line-height: 1;
  cursor: pointer;
  background: #fff;
  padding: 6px 8px;
  border-radius: 3px;
  font-size: 14px;
  color: #000000;
  margin: 0 5px;
  outline: none;
  border: 1px solid #dcdfe6;
}

.exportBtn {
  visibility: hidden;
}

.uploadFile {
  text-decoration: none;
  display: inline-flex;
  position: relative;
  overflow: hidden;
}

.uploadFile input {
  position: absolute;
  font-size: 100px;
  cursor: pointer;
  right: 0;
  top: 0;
  opacity: 0;
}

.btn[disabled] {
  color: #aaaaaa;
}

.icon-btn-row {
  position: relative;
  cursor: pointer;
}

.githubIcon {
  position: absolute;
  top: -4px;
  left: 12px;
}
.githubText {
  padding-left: 30px;
  padding: 8px 8px 8px 36px;
}

.tips {
  font-size: 12px;
  margin: 0;
  color: #aaaaaa;
  line-height: 1.4;
  padding: 5px 15px;
}
.primary {
  color: #409eff;
  border-color: #409eff;
}

.black {
  color: #24292e;
  border-color: #24292e;
}

//暗黑主题
.container.darkMode {
  color: rgba($color: #ffffff, $alpha: 0.6);
  background-color: #121212;
  .btn {
    background-color: rgba($color: #ffffff, $alpha: 0.16);
    color: rgba($color: #ffffff, $alpha: 0.6);
    border: 1px solid rgba($color: #ffffff, $alpha: 0.6);
  }
  .primary {
    border: 1px solid rgba($color: #409eff, $alpha: 0.6);
    background-color: rgba($color: #409eff, $alpha: 0.6);
  }

  .setting-list {
    background-color: rgba($color: #ffffff, $alpha: 0.11);
  }

  .setting-list li {
    border-bottom: 1px solid rgba($color: #ffffff, $alpha: 0.38);
  }

  /deep/ .el-switch__label.is-active {
    color: rgba($color: #409eff, $alpha: 0.87);
  }
  /deep/ .el-switch__label {
    color: rgba($color: #ffffff, $alpha: 0.6);
  }

  /deep/ .el-switch.is-checked .el-switch__core {
    border: 1px solid rgba($color: #409eff, $alpha: 0.6);
    background-color: rgba($color: #409eff, $alpha: 0.6);
  }

  /deep/ .el-radio__input.is-checked + .el-radio__label {
    color: rgba($color: #409eff, $alpha: 0.87);
  }
  /deep/ .el-radio__input.is-checked .el-radio__inner {
    background-color: rgba($color: #409eff, $alpha: 0.6);
    border: 1px solid rgba($color: #409eff, $alpha: 0.6);
  }
  /deep/ .el-radio.is-bordered.is-checked {
    border: 1px solid rgba($color: #409eff, $alpha: 0.6);
  }
  /deep/ .el-radio.is-bordered {
    border: 1px solid rgba($color: #ffffff, $alpha: 0.6);
  }
  /deep/ .el-radio {
    color: rgba($color: #ffffff, $alpha: 0.6);
  }
}
</style>
