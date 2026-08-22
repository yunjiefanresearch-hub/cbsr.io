# 落地页（index.html）优化说明

对应版本 v0.11.0。本次只改 `index.html` 与 `assets/cbsr.css`（后者为末尾追加，不改动任何既有规则）。
`<header class="top">` 与 `<footer>` 两段与原版逐字节一致，`python3 tools/sync-shell.py --check` 不会报漂移，其余九个页面无需同步。

---

## 一、内容层面

### 1. 首屏主标题：把一句会被本页自己推翻的话换掉

**修改前**

> It will refuse to answer 152 of 152 questions today. That is why it can be trusted.
> 它今天会拒绝回答 152 个问题里的 152 个。这才是它能被信任的原因。

**修改后**

> Agents are starting to move money. Nothing underneath them can be cited.
> AI 智能体已经开始动钱了。它们脚下没有一样东西经得起被引用。

四个理由：

其一，原句与本页下方自相矛盾。`decision_ready = 0` 约束的是 `citable_law()` 这一层，不是整份登记册；而同一页往下滚半屏，通道层就带着类别、机制和日期把 EU→US 答了出来。一个把"我能证明自己什么时候不该答"当作全部卖点的项目，开篇给出一个被自己三屏之内证伪的拒答主张，损失最大。

其二，`records`（152 条命题）不等于"问题"，原句在计量单位上就不成立。

其三，"152 of 152" 是硬编码在全站最显眼那行字里的数字。`assets/cbsr-live.js` 的文件头注释写得很清楚，v0.10.1 的事故正是手写数字造成的；把手写数字放回 `<h1>`，等于在最难被发现的地方重开了同一个口子。

其四，"That is why it can be trusted" 是项目用自己的嘴断言自己可信。这一类断言恰恰是本页别处一直在避免的动作。

被换下来的那段六轴论述没有丢，移到首屏第三段——它在那里是**纪律**，在标题位置则是**谜语**。首屏顺序现在是：问题一句话 → 这是什么（一句大白话）→ 纪律与它今天的代价。

### 2. 首屏补一句"这到底是什么"

原首屏没有任何一句平白地说明 CBSR 是什么，读者要到第三段才拼得出来；唯一的定义藏在页眉 13px 的品牌行里。OpenSSF `description_good` 条目的自评答案里写的是"项目网站说明了软件做什么"，这一条现在才真正落到页面上。

新增（`.lede`）：

> CBSR is an open, versioned register of how twelve jurisdictions regulate stablecoins, together with a policy engine that reads it. Every proposition is pinned to a provision of primary law, carries the date it was read, and reaches software as typed tools rather than as prose.

### 3. 新增 `#decide`：政策引擎（本次最大的一处补缺）

底层仓库的自我描述里，登记册和**政策引擎**是两件并列的制品，而引擎那一半此前在整个站点上不存在——全站十一个页面没有出现过 `evaluate_action`、`execution_authorized`、`review_required`、`insufficient_evidence`，也没有出现过决策回执。`fail-closed` 一词全站只出现一次，就在首屏，从未兑现。

同时，首屏原主按钮写的是 **"Evaluate an action"**，点过去是 `agents.html`，那一页并不能评估任何动作。承诺与交付对不上。

新增的 `#decide` 一节给出：

- 调用与返回两段并排代码（沿用既有 `.env` 组件，明确标注为形状示例而非会话记录，权威签名指向 `MCP_SERVER.md`）；
- `execution_authorized` 恒为 `false`——不持密钥、不提交交易、不托管资产，没有任何输入或未来版本能把它翻成 true；
- 证据链未闭合返回 `review_required`，输入畸形或超授权范围返回 `insufficient_evidence`；
- 回执：对规范化 JSON 取 SHA-256，标识由摘要确定性导出，相同输入重放得到逐字节相同的回执；
- 三个数字：`false` / 31 个表驱动政策场景 / 13 个回执篡改用例；
- 一段主动的自我限制——回执检出的是篡改不是身份，它不是签名，其中的审计身份由调用方声称、CBSR 不验证。

首屏主按钮改为 `See the engine decide` → `#decide`，页内直达，不再是一句兑现不了的承诺。

### 4. 新增 `#use`：三条一分钟能走完的路

原页面读者被说服之后，唯一的下一步动作是"再读一页论证"。新增三张卡（复用 `.pillars three`，零新样式）：直接读 `api/index.json` 自描述端点；把 MCP server 挂进智能体（`MCP_SERVER.md` + `docs/CONNECT_MCP.md`）；固定版本并引用（Zenodo DOI + `CITATION.cff`，复现构建跑 `python -m tools.verify`）。

三条路径全部指向仓库中确实存在的文件与命令，没有杜撰安装包名或配置片段。

### 5. `#gap` 两段"答案"标注为示例

这两段带引号排版，读起来像两次真实会话的记录，实际是写出来的示例。本页第三节刚刚批评过"不带出处的转述"，自己就不能在第五节做同一件事。已在两栏下方加一行 `.subcap` 说明：两段都是书面示例，左栏复现无接地答案的典型形状，右栏是同一问题走通道层之后的字段。

### 6. `#readers` 删掉一处无出处的市场数字

**修改前**：A digital-assets partner in London or Hong Kong bills north of $1,000 an hour to write one.

**修改后**：Today that answer lives in law-firm memoranda: billed by the hour, delivered as prose, stale a quarter after you buy it, and unreadable by software.

具体费率是一个不带日期、不带来源、无法核对的断言，正是本页反复指认的那一类。结构性论点（按小时计费、散文交付、一个季度过时、软件读不懂）不依赖这个数字，去掉之后更强。

### 7. 术语首次出现补全称

中文一侧原本大量夹杂未解释的英文缩写。已按首次出现补全：模型上下文协议（Model Context Protocol，MCP）、失败即关闭（fail-closed，含义随后解释）、持续集成（CI）、数据结构约定（schema）、AI 智能体（agent）、智能体金融（agentic finance）。`agent` / `agentic` 在中文正文中统一改用"智能体"，仅在首次出现处并列英文以保留检索性。

另：原中文里的 "SLA 窗口" 未作解释，已改写为"约定的复核周期"，语义不变而不再引入一个未定义的缩写。

`KYA` 原本已有全称，保留不动；论文标题按仓库既定规则不翻译。

---

## 二、格式与结构层面

### 8. 补齐标题层级

原页面十一个 section 里有九个没有 `<h2>`，只有一段 `<p class="kick">` 在视觉上充当小标题。屏幕阅读器按标题导航时，整页从"One proposition. Six axes."直接跳到"Twelve legal systems."，中间四节完全消失；搜索引擎看到的也是一堆没有父级的 `<h3>`。

现在每个 section 都有一个真实的 `<h2 class="h-sec">`（复用既有样式，无新增 CSS），`.kick` 退回它本来的角色——眉题。新加的标题都控制在一行以内。

### 9. 剩余硬编码数字改为绑定

`152`、`132`、`12`/`twelve` 原本以字面量散落在正文里。现全部改用 `data-live`：

| 数字 | 绑定键 | 说明 |
| --- | --- | --- |
| 152 | `records` | 已存在，`cbsr-live.js` 已实现 |
| 12 | `jurisdictions` | 已存在，此前未被页面使用 |
| 132 | `authored_corridors` | 已存在，此前未被页面使用 |

`cbsr-live.js` 无需修改。`apply()` 对缺失或为 null 的键跳过不写，所以即使某个键在 `meta.json` 中不存在，页面仍显示标记里的构建期回退值。

**部署后请核一件事**：`meta.json` 里 `authored_corridors` 的语义是否等于 12×11=132 这张完备有向图。若它统计的是"已撰写的通道"这类更窄的口径，请把这三处 `data-live="authored_corridors"` 撤掉，或在登记册侧补一个 `directed_corridors` 键再绑。另外 `assets/cbsr.js` 第 163、168 行的 `count()` 里也各硬编码了一个 132，宜一并纳入同一治理。

`gcap` 里的 "56 of the 66 jurisdiction pairs" 暂未绑定——`meta.json` 目前不发布这个量。建议登记册侧增加 `directional_asymmetry_pairs`，之后再绑。

### 10. 元信息统一为一条讯息

原来 `<title>`、`og:title`、`<h1>` 各说各的，分享卡片承诺一个论点、点进来看到另一个。现在三者统一到 `og:title` 那句（它本来就是三句里最好的一句）。

`meta description` 原文以覆盖率开场（"Twelve jurisdictions, 132 directed corridors..."），与首屏的 fail-closed 立场相抵；已改写为先说是什么、再说它不做什么。

新增 `hreflang`（en / zh-Hans / x-default）与 `color-scheme: light`。三条 `hreflang` 复用 `__SITE_URL__` 占位符，部署流水线是全局替换，会一并打戳。

### 11. 可访问性

- 通道判定卡容器加 `aria-live="polite"`：读者拖动日期滑块时，两张卡的结论变化会被读出来，此前是静默变更。
- SVG 的 `aria-label` 原文描述的是默认日期下的图，滑块一动这段描述就成了假话。已改写为明示"下述为控件所选日期下的状态"。

### 12. 新增打印样式

站点原本没有 `@media print`。这份东西在性质上就是一份带日期的法律备忘录，会被打印。新增的打印规则把页眉、语言开关、按钮、滑块、页脚导航移出；把 `.env`、`.pcard`、`.ans.good`、`.verdict` 四个深底块反白（否则整版吃墨）；多列布局压成单列；section 避免跨页断开。

### 13. 一处仓库清理

根目录的 `cbsr.js` 与 `assets/cbsr.js` 逐字节相同（md5 均为 `194777ce…`），且十一个页面全部引用 `assets/` 下那份，根目录这份没有任何引用。建议删除：

```bash
git rm cbsr.js
```

（zip 里无法表达删除动作，故在此列出。）

---

## 三、未改动的部分

配色、字体、间距、组件形态、双语机制、内容安全策略（CSP）、`__SITE_URL__` 占位符、`.git` 之外的一切文件，均按原样保留。新增 CSS 全部追加在 `assets/cbsr.css` 末尾并加了分隔注释，作用域限定在只有首页才有的标记上，其余九页形态不变。

## 四、部署后建议跑一遍

```bash
python3 tools/sync-shell.py --check        # 应无漂移
npm i -D playwright && npx playwright install chromium
node tools/test-site.mjs .                 # 现有套件
```

现有套件里有一条断言是"切到中文后任何页面都没有未翻译的块"。新增的两段代码块中，注释行已挂 `data-zh`，字段名与取值按代码惯例两种语言下一致。若该断言的实现方式是逐元素比对而非白名单，跑一次即可确认。
