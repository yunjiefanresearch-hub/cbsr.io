# 第二轮：版式故障修复、全站深度审阅与去重

承接上一轮的落地页优化。本轮改动 6 个文件：`index.html`、`assets/cbsr.css`、`maintain.html`、`method.html`、`standards.html`、`corridors.html`。
`<header class="top">` 与 `<footer>` 全部保持原样，`python3 tools/sync-shell.py --check` 不会报漂移。

---

## 一、截图里那些"很奇怪"的排版，根因是两处 CSS 类名撞车

不是风格问题，是同一个类名被两个完全不同的组件占用，后写的规则把先写的组件冲掉了。两处都是来料自带的，一处影响八个子页，一处影响落地页。

### 撞车一：`.masthead` —— 影响 8 个子页（对应第 2、3、4、5、6、7 张截图）

`assets/cbsr.css` 里 `.masthead` 有两套定义：

- 第 282 行起，**页面头组件**：`padding` + serif 大标题 + 无衬线导语。`about / agents / corridors / kya / maintain / method / research / standards` 八个页面的 `<section class="masthead">` 用的是它。
- 第 511 行起，**首页日期头组件**：`display:flex` + `font-family:var(--mono)` + `font-size:12px` + `border-bottom:2px solid var(--ink)`。这是 v0.11.0 为首页那行「登记册名 · 版本 · 截止日 · DOI」新写的，配套 `.mh-name / .mh-sep / .mh-item / .mh-doi`。

后者在文件里靠后，于是八个子页的 `<section class="masthead">` 一并继承了 `display:flex` 和等宽字体。三个后果恰好就是截图里看到的：

| 截图现象 | 来自哪条声明 |
| --- | --- |
| 眉题（`THE CORRIDOR LAYER · V0.11.0`）跑到大标题左边，同行并排 | `display:flex; align-items:baseline` 把 `.kick` 和 `<h1>` 变成了同一行的弹性子项 |
| 导语整段变成等宽字体 | `font-family:var(--mono)` 沿继承链落到 `.lede` |
| 导语下方多出一条粗黑横线 | `border-bottom:2px solid var(--ink)` |
| 第 5 张（standards）眉题在上、其余在左 | `flex-wrap:wrap` —— 标题够长就被挤到下一行，够短就并排，所以八个页面表现还不一致 |

**修复**：把首页那套改名为 `.dateline`（它本来就是首页独有，`.mh-*` 子元素也只有首页在用），`index.html` 同步改一处标签。八个子页的 `.masthead` 回到只剩 `padding:52px 0 34px` —— 也就是它原本被设计成的样子，这八个页面不需要改动任何一行 HTML。

### 撞车二：`.rec` —— 影响落地页的记录卡（对应第 1 张截图）

同样两套定义：

- 第 252 行：`.paper,.rec{display:grid; grid-template-columns:1fr auto; padding:16px 0; border-top:…}` —— 论文列表用的行式组件。
- 第 564 行：`.rec{border:1px solid …; background:…; padding:0; margin:26px 0 0}` —— 落地页的记录卡，**没有复位 `display` 和 `grid-template-columns`**。

于是记录卡变成了一个 `1fr auto` 的两列网格，五个子元素（卡头、命题、来源表、六轴、判词）被自动流进两列。六轴那一格是不可压缩的，把 `auto` 列撑满，`1fr` 列被挤到几十像素宽——这就是第 1 张截图里 `Stablecoins Ordinance (Cap. 656)` 一个字一个字往下掉的原因。

**修复**：把 `.rec` 从 `.paper` 那一族的 8 条选择器里摘掉。核实过：`class="rec"` 全站只有 `index.html` 用了一次，`research.html` 的论文列表用的是 `class="paper"`，所以 `.rec` 在那一族里本来就是没人用的搭头。摘掉之后 `<article class="rec">` 恢复块级、满宽，六轴一行六格正常排开。

这类事故还会再发生，因为这套样式表按页面而不是按组件分区，同名组件容易二次占用。建议后续新组件命名带页面前缀（如 `.idx-*`），或在每个新块顶部显式写 `display`。

---

## 二、内容深度审阅：v0.10.1 那个缺陷仍在四个子页上线着

`assets/cbsr-live.js` 的文件头注释把话说得很重：v0.10.1 时站点把 46 当作"citable as binding law"发布出去，而 `decision_ready` 其实是 0，46 只是结构性候选数——对一个以证据纪律立身的项目，这是"唯一不能发出去的缺陷"。

上一轮我修的是 `index.html`。这次全站扫下来，**这个缺陷还活在另外四个页面上，而且全是硬编码、不受 `data-live` 约束**：

| 位置 | 修改前 | 修改后 |
| --- | --- | --- |
| `maintain.html` 导语 | of 152 sourced records, **46 clear the full citable bar** | 绑定为：152 条溯源记录，46 条通过结构性筛选，**0 条通过六轴全部门槛**；并点明绑定轴是独立复核——正好是维护者能动的那一轴 |
| `method.html` mast-meta | 152 sourced records, **46 clearing the full citable bar** | 绑定为 152 records / 46 structural candidates / 0 decision-ready |
| `method.html` 三轴小节标题 | Which records may be cited as **current binding law** | Which records are even a **candidate**（三轴只是必要条件） |
| `method.html` 三轴导语 | Their intersection **is the subset a lawyer or a supervisor can cite as current binding law** | 交集给出结构性候选；时效与独立复核两条轴还压在上面，六条全过才可引用 |
| `method.html` 公式 | → **46 citable records** | → 46 structural candidates（绑定） |
| `method.html` 统计块 | 46「clear the full citable bar」/ 106「confirmed at regime level」 | 46 通过结构性筛选（绑定）/ **0 通过六轴**（绑定）。106 是 152−46，属可推导的冗余，删去 |
| `method.html` 结语段 | The register is at **v0.10.x** … **Forty-six records meet the full bar** | 删掉过期两个版本的版本号；改为"通过结构性筛选的那一批仍要过时效与独立复核，今天还没有一条走完" |
| `standards.html` 支撑记录 | All 152 records …; the **46-record citable subset** | 绑定为 152 records / 46 structural candidates 中 0 条 decision-ready |

值得一提：`standards.html` 和 `about.html` 的**中文 `data-zh` 早已是正确表述并且绑定了**，只有英文原文没跟着改。这说明上一次修订漏的是英文一侧，两种语言在同一页上说着互相矛盾的话。

另外 `corridors.html` 的 mast-meta 写着 `dateline 30 June 2026`——这正是 `cbsr-live.js` 注释里点名的另一处 v0.10.1 遗留（"Dateline 30 June 2026 in two [places]"）。登记册当前 `as_of` 是 2026 年 8 月 20 日，落后两个版本。已改为绑定 `as_of`，同页的 `12` 与 `132` 也一并绑到 `jurisdictions` 与 `authored_corridors`。

---

## 三、去重

跨页逐字重复的整句，改前 8 句，改后 2 句：

**已消除**

- `index.html #commitment` 与 `about.html` 的依赖声明有 **4 句逐字相同**。落地页是门面，不该把完整声明抄一遍。已压成一段（保留最要紧的"带日期的快照、不是实时数据源"和"依赖前请回一手来源核对"），完整声明由新增的一个按钮指回 `about.html`。两段并一段。
- `index.html #join` 与 `maintain.html` 导语有 **2 句逐字相同**。已压成一段，并且不再重复 `#record` 里已经讲过的"移动这一轴不需要更多代码，需要第二个人读原文"——同一个意思原本在落地页上出现了两次。
- `#decide` 和 `#gap` 原本各有一个按钮，文字与目标完全相同（都是 agents.html 的"接地契约与四种失败"）。`#decide` 那个改为指向类型化工具。
- `method.html` 统计块里的 `106` 等于 `152 − 46`，属推导冗余，删。

**保留**

- `about.html` 与 `research.html` 各有一份 Zenodo 引用串——两处都需要能被直接复制，属必要重复。
- `maintain.html` 与 `thanks.html` 各有一句"两周没回音请再寄一次"——确认页复述提交页的关键提示，属必要重复。

---

## 四、版式：其他一并修掉的

### 相邻两堵卡片墙

上一轮新增的 `#use` 和它上面的 `#surfaces` 都是 `.pillars three`（三张卡），连着两屏同一种形态，节奏发木。`#use` 改用 `.layers` 编号行式组件（`method.html` 已在用），链接内嵌在正文里。零新增样式。

### 子页也缺 `<h2>`

上一轮在落地页修掉的那个结构缺陷，八个子页都有：section 只有一段 `<p class="kick">` 眉题充当小标题，屏幕阅读器按标题导航时整节消失。本轮已为在改的四个页面补齐 **10 个 `<h2 class="h-sec">`**：

- `maintain.html` — `#role`、`#howread`、`#other`
- `method.html` — `#layers`、`#backlog`
- `standards.html` — `#tradition`、`#machine`
- `corridors.html` — `#live`、`#direction`、`#reading`

**尚未处理**（本轮没有改动这四个文件，不便盲改）：

- `about.html` — `#who`、`#reliance`、`#privacy`、`#cite`
- `agents.html` — `#thesis`、`#wire`
- `kya.html` — `#status`、`#why`、`#nonclaims`
- `research.html` — `#citing`

补法与上面完全一致：在 `<p class="kick">…</p>` 之后插一行 `<h2 class="h-sec" data-zh="中文">English</h2>`，复用既有样式，不需要动 CSS。

---

## 五、关于那一行邮箱

`maintain.html` mast-meta 里的 `applications go to yunjiefan.research@gmail.com` 已按要求删除，中英文两侧都改为"经由下方表单提交 / applications go through the form below"。

同页另有三处仍出现该地址，都属功能性，未动，列出来供你定夺：

1. 第 179 行 `<form action="https://formsubmit.co/yunjiefan.research@gmail.com">` —— 表单不经这里就投不出去。
2. 第 320 行 `mailto:` 兜底链接 —— README 里说明这是转发服务不可达时的备用路径，删掉会让填完表的人无处可投。
3. 第 326 行隐私说明"表单通过一个转发服务把内容送到 yunjiefan.research@gmail.com" —— 这是主动披露收件地，删掉会削弱这段披露本身。

如果目的是防爬取，README 里已经写好了正解：FormSubmit 可以签发一个随机串端点，投递到同一信箱而地址不出现在 HTML 里。换成那个端点，第 1 和第 3 处就都不必再写出地址，第 2 处可视情况保留。

---

## 六、部署后建议跑一遍

```bash
python3 tools/sync-shell.py --check        # 应无漂移
node tools/test-site.mjs .                 # 现有套件
```

另外上一轮提过、这一轮仍待确认的一件事：`meta.json` 里 `authored_corridors` 的语义是否等于 12×11=132 的完备有向图。现在 `index.html` 与 `corridors.html` 都绑了这个键，若语义更窄需一并撤掉。`assets/cbsr.js` 第 163、168 行的 `count()` 里各还有一个硬编码 132，宜纳入同一治理。
