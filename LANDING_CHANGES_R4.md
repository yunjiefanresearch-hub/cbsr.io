# 第四轮：按参考站的版式语汇重做落地页

改动 6 个文件：`index.html`（重写）、`assets/cbsr.css`（末尾追加 r4 层）、以及 `maintain.html`、`method.html`、`standards.html`、`corridors.html` 的页眉对齐。

---

## 一、我从参考站拿到了什么，没拿到什么

`my-site-298e6603.ploy.build` 这次抓取成功了（首页与 `/method` 两页）。

**拿到的**：完整的版式语汇、模块顺序、每个模块的文案与结构、页眉页脚构成、以及整站的措辞纪律。

**没拿到的**：精确色值、字体文件、间距数值。抓取器只返回提取后的文本，`og-card.png` 请求被"图片内容不支持"拒绝，Astro 打包的 CSS 路径无法凭空构造。

所以本轮做的是**照着它的版式语汇重排**，调色与字族沿用你自己的（徽标是纯黑，站上是纸色/墨色/衬线标题）。要精确对色，给我一张首屏截图即可，那是纯换值的活。

---

## 二、参考站的签名，以及我搬过来的部分

参考站真正的识别度不在配色，在一条贯穿全站的措辞纪律：**几乎每个模块都配一条 "Does not claim"**。六轴每一条都写自己不主张什么，七步管线每一步都写，六类读者每一类都是 Supports／Does not claim 成对，联合国边界单独立一块。这是这个项目最该有的样子，我按这个把落地页重做了。

| 参考站的模块 | 本轮落地页 |
| --- | --- |
| 居中大问句首屏（眉题 → H1 → 一段 → 两个按钮） | 已采用。H1 就是 `May this money cross this border?` / 「钱能不能过这道边界？」 |
| 四格数字带 `12 / 132 / 152 / 0` | 已采用，`.statband`。第四格 `0` 用琥珀色单独标出，下面接一行解释它为什么是 0 |
| 六轴改为行式表，每行 = 名称 + 取值 + 它不主张什么 | 已采用，`.axlist`。这一条是本轮最大的内容升级——原来只有六个色块，现在每一格自己声明边界 |
| 加粗判词 "Current projection: declined." | 已采用 |
| Supports ／ Does not claim 成对结构 | 已采用，`.boundary .bpair` 与 `.duty` 卡片 |
| 「谁在读它」六类读者，各带非主张 | 已采用，六张卡 |
| 联合国边界独立方块 | 已采用，`.boundary.un`（靛蓝描边） |
| 六个界面链接网格 | 已采用，`.idx` |
| 机构路径带 + Start a conversation | 已采用，`.inst` 全宽带 + 邮件按钮 |
| Work with the system 四链接行 | 已采用，`.workrow` |
| 页脚两行（版本许可行 + 免责行） | 已采用 |
| 页眉 `CBSR / Evidence infrastructure for agentic finance` + 版本 + Open register | 已采用，四个子页同步 |

**没搬的**：七步管线。参考站把它放回来了，但你的 `method.html` 有更完整的五层架构加六层构建管线，落地页再放一遍仍是重复。它的"每步一条非主张"这个做法我搬了，用在了六轴和读者卡上。

---

## 三、内容仍是四层依赖

上一轮定下的骨架保留：底座 → 卡点 → 变现 → 位置。参考站是按"什么／谁在读／怎么做成的"分块，你的四层是按依赖分层，后者更有论点。所以做法是**四层内容穿参考站的版式**，两者不冲突：

```
首屏（居中大问句）
四格数字带 + 为什么第四格是 0
一条记录 · 六轴 · 每轴的非主张
四层依赖堆栈
第一层 底座   ← 两栏对照、引擎与回执、有向通道、这一层的价格（成对结构）
第二层 卡点   ← 三条做法 + 维护者入口
第三层 变现   ← 三张卡，每张带非主张
第四层 位置   ← 两颗种子 + 联合国边界方块
谁在读它      ← 六类读者，Supports／Does not claim
覆盖范围      ← 结算是框架，稳定币是第一个工具类别
六个界面
机构路径带
```

参考站的首屏按钮是 `Use mapper`，指向站内嵌入的映射器。你的静态站没有这个嵌入，所以我改为 `Open the corridor layer` 指向 `corridors.html`。要把映射器也嵌进来，`corridors.html` 已经有 iframe，可以照搬——但那需要给内容安全策略加 `frame-src`，先说一声。

---

## 四、三处技术坑，已处理

**`padding` 简写打架。** 新版把 `.wrap` 挂在 `<section>` 上（让某些带可以全宽），于是同一个元素同时命中 `.wrap{padding:0 28px}` 和我原本写的 `main > section{padding:74px 0 0}`。`padding` 是简写，后者会把左右内边距整个抹掉。已改成长写 `padding-top`。

**新规则会波及四个子页。** `main > section` 和 `.rule{display:none}` 都是全局选择器，而 `corridors / maintain / method / standards` 四页都在用 `<hr class="rule">` 做分隔。已给 `<body class="home">` 加作用域，并把 `.rule{display:none}` 整条删掉（新首页本来就没有 `<hr>`）。

**`.inst` 全宽带的顶间距。** 它自己有 `padding:64px 0 60px`，又会吃到 `.home main > section{padding-top:74px}`。已用 `!important` 让带自己的值胜出，并给它内部的 `.wrap` 清零。

---

## 五、部署前要做的

1. **跑 `python3 tools/sync-shell.py`**（不是 `--check`）。页眉这轮加了 `Open register` 按钮、换了副标题、`Agents` 改为 `Access`；页脚改成两行制。zip 里四个子页我已经手工对齐过，但其余页面要靠它推。
2. **仓库 slug 仍然不要动**——`cbsr-live.js` 的 `REGISTER_API` 硬指向 `.../cross-border-stablecoin-register/api`。
3. `about.html`、`agents.html`、`kya.html`、`research.html` 这轮仍未动：12 个 section 缺 `h2`，正文可能还有旧名。
4. 参考站的 `/method` 页 `og:url` 指向 `https://cbsr.site/method`，而 `og:image` 指向 `https://cbsr.site/og-card.png`——首页那两个字段却指向 `my-site-298e6603.ploy.build`。两处域名不一致，分享卡在部分平台会取错图。既然你已经有 `cbsr.site`，建议统一。

## 六、仍待确认（前几轮遗留）

`meta.json` 里 `authored_corridors` 的语义是否等于 12×11=132（首页与 corridors 页都绑了这个键）；`assets/cbsr.js` 第 163、168 行各有一个硬编码 132。
