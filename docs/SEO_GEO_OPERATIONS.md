# CBSR SEO / GEO 发布、验收与持续运营

本说明对应 2026-10-17 的改造。代码、页面生成与发布检查的完成，不表示 Google、Bing 或 AI 产品已经收录、采纳 canonical 或开始引用。收录和引用必须在真实发布后另行记录。

## 1. 本次代码交付与事实边界

- 英文原有地址保留；中文输出到 `/zh/` 和对应子路径。语言切换使用真实链接，中文正文、标题、描述在初始 HTML 中存在，无需执行脚本。
- 构建统一生成绝对 canonical、Open Graph URL / 图片、互相对应的 `en` / `zh-Hans` / `x-default`、JSON-LD 与 sitemap。首页的 `/index.html` 声明规范地址 `/`；中文首页相应为 `/zh/`。
- 首页直接介绍 CBSR 产品品牌与其首个已发布垂类 Cross-Border Stablecoin Register 的关系；数据、研究与证据说明可通过普通链接发现。
- 数据版本仍为 **v0.11.0**，快照截至 **2026-08-20**：152 条记录、46 条结构性候选、0 条 decision-ready；103 条有官方来源、41 条有一名审阅人、0 条完成独立二审。这些数据没有因修改网页而获得新的法律时效。正式数据集引用名保持不变。
- Dataset 许可为 CC-BY-4.0；软件为 Apache-2.0。历史研究和 PDF 保持原版和原始时点。公开评论或机构列载不表示监管机构背书。
- 发布产物从明确的公开文件范围生成，Git、CI、工具、内容源、审计和测试资料不随站点上传。`build-manifest.json` 可用于核对产物身份，不代表来源已获独立复核。

`robots.txt` 与 `llms.txt` 仅提供访问和阅读提示。`llms.txt` 不是收录凭据、排名开关或模型推荐保证。本站没有虚构 IndexNow 验证 key，也未代为完成站长账户设置。

站名首选仍为 `CBSR`；现有唯一 `WebSite` 节点通过 `alternateName: ["cbsr.site"]` 提供备用名，首页中英文首段同步明确品牌与域名的对应关系。这遵循 [Google 站名指南](https://developers.google.com/search/docs/appearance/site-names)，仅表达站名偏好，不保证 Google 采用该名称、停止查询拼写纠正或提高排名，也不改变正式数据集引用名。

## 2. 构建和发布

部署只能上传 `_site/`，不要再把仓库根目录直接作为 GitHub Pages 产物。GitHub Pages 的发布工作流会读取实际 Pages base URL，先运行原有 Register 快照、live fallback 和公开政策材料检查，再生成并验收产物；失败即停止上传。PR 检查同时验证自定义域名与项目子路径部署。

本地使用 Python 3.10 或更高版本的标准库，无需安装站点构建依赖：

```text
python3 tools/build_search_site.py --base-url https://cbsr.site/ --output _site
python3 tools/search_site_test.py --site-dir _site --base-url https://cbsr.site/
```

Windows 可把 `python3` 换成实际 Python 3 解释器路径。输出目录必须位于仓库内，并以 `_` 开头；构建器拒绝覆盖源码、项目外目录和符号链接。需要预览时从产物目录启动本地 HTTP 服务；不要把模板源码目录当成最终网页预览。

产物检查覆盖规范地址唯一性、sitemap 与可索引 HTML 一致性、语言互链、无脚本中文正文、结构化数据、0 / 46 的复核边界、链接和锚点、资源、表单、重复构建字节稳定、项目路径与不安全输出拒绝。原有快照与政策材料测试仍在 CI 中执行，旧的 `tools/test-site.mjs` 中固定导航数量和脚本语言按钮断言不作为新语言链接的验收依据。

网页实质修改日、数据生成日、法律审阅日是三种不同日期。不要为让页面“新鲜”而把所有 sitemap `lastmod` 或数据 `as_of` 改成部署当天。新的数据发布应先更新固定的 Register revision 与公开快照，再同步页面、结构化数据和现有契约。

## 3. 发布后 HTTP 与内容验收

真实部署后记录部署 commit、公开 URL、日期、状态码和检查结果：

1. 检查 `https://cbsr.site/`、`/zh/`、`/data/` 和新增试点页均返回 200；随机不存在的地址真实返回 404。`www`、HTTP 与旧官网入口仍指向唯一 HTTPS 主域。
2. 在禁用 JavaScript 的浏览器或“查看源代码”中确认中文首段、作者、来源、版本和 0 / 46 边界可读。切换语言后处在同一内容的另一语言页。
3. 核对 canonical、hreflang 与 sitemap 都是正式主域。sitemap 不包含 404、thanks、重定向或仅交互状态地址。
4. 检查所有公开 PDF、数据下载、原始来源链接及维护者表单。构建验收会校验站内链接；外站状态需单独复查。
5. 用 Google Rich Results Test / Schema Markup Validator 检查 JSON-LD。有效结构化数据与获得富结果是两件事，测试通过不保证展示。
6. 对 Googlebot / Bingbot / `OAI-SearchBot` 的可达性，以真实站长抓取或访问日志为证据；仅改 User-Agent 请求不能证明对应服务的实际 IP 可访问。若有 WAF / CDN，另查这些服务是否被挑战或阻断。

如出现构建异常或页面回归，回退到上一通过验收的部署 commit，并重新执行同一套构建与快照检查。不要为应急发布绕过整个产物验收或上传源码根目录。

## 4. 需要站点所有者账户执行的步骤

这些步骤不属于 HTML 可以自动完成的能力；尚无后台结果时，状态应记为“待站主执行 / 待验证”。

| 账户 / 服务 | 实际操作 | 留存的验收证据 |
|---|---|---|
| Google Search Console | 验证 `cbsr.site` Domain property（通常需 DNS 权限）；提交正式 `sitemap.xml`。检查首页、中文首页、数据页、方法页及试点研究页的 URL Inspection；必要时请求重新编入索引 | Google 选择的 canonical、索引原因、最近抓取、渲染正文与提交日期 |
| Bing Webmaster Tools | 验证主域，提交 sitemap，使用 URL Inspection 检查同一组页面；审查抓取和封禁信息 | 抓取 / 索引结果、站点地图状态、日期 |
| GitHub 仓库 About / Website | 把营销站 Website 统一为 `https://cbsr.site/`；正式数据集仓库可把 Website 指向 `https://cbsr.site/data/`，保留原始数据 API / GitHub Pages 的数据访问入口。同步 README 的官网、数据集、作者和引用链接 | 仓库地址、修改后的 About / README 内容 |
| OpenSSF Best Practices | 项目 14172 的 homepage 改为主域；软件仓库地址保持真实源码地址 | 项目公开 JSON 中的 `homepage_url` |
| 作者 ORCID / SSRN / LinkedIn / Zenodo 等 | 在可编辑的个人简介、项目资料、相关链接中统一写清 CBSR 产品与正式数据集关系，链接官网 / 数据介绍；历史论文正文和历史 DOI 不重写 | 公开个人主页和项目记录的对应入口 |
| 数据站与 Mapper | 如不在本仓库，给其真实入口加回官网和数据介绍的普通链接；安排独立构建输出静态摘要并检查 canonical，不把其他子站重定向掉 | 子站页面初始 HTML、回链、canonical、核心状态文本 |

账户验证 TXT、HTML 文件或 API key 只能使用服务实际签发的值。当前没有 IndexNow key，因此未启用自动通知。未来接入时先完成同一 host 的 key ownership 验证，只提交真实发布、同 host 的规范 URL，并保护 key 与通知记录。IndexNow 接受通知也不等于已索引。

## 5. 固定基线与效果跟踪

首次发布日记为 D0，并在 D7、D14、D28 记录同一组查询。固定搜索产品、地区、语言、设备及是否登录，保留日期和对应结果。`site:` 抽样不能用来计算完整收录数量；以站长后台为主要诊断依据。

| 查询组 | 固定查询示例 | 首要观察 |
|---|---|---|
| 官网导航 | `cbsr.site`、`"cbsr.site"` | 能否稳定返回正确官网首页 |
| 品牌区分 | `CBSR stablecoin`、`CBSR agentic finance` | 是否把 CBSR 与同名机构区分，标题摘要是否准确 |
| 正式数据集 | `"Cross-Border Stablecoin Register"` | 主域数据页、DOI、仓库的关系是否清晰 |
| 作者关系 | `"CBSR" "Yunjie Fan"` | 作者身份是否连接到官网与数据集 |
| 中文 | `CBSR 稳定币`、`跨境稳定币登记册 CBSR`、`CBSR 金融智能体` | 是否出现真实中文页面，是否对应中文 canonical |
| 主题与研究 | `CBSR stablecoin corridor evidence`、`CBSR Know Your Agent` | 是否返回有独立价值且与问题相关的证据页 |
| 同名缩写 | `CBSR` | 长期观察；不把裸词短期首位当作本次唯一验收标准 |

每周关注 Search Console / Bing 中官网查询的曝光、点击、实际索引、canonical 异常和新增内容发现情况。把“查询无结果”“页面未索引”“已索引但未排名”“摘要表述错误”分别记录，再采取对应动作，避免用反复请求索引替代诊断。

建议结果表字段：日期、搜索产品、语言 / 地区、查询、出现 URL、标题摘要、位置或结果截屏、后台索引状态、下一步。无后台权限的数据写“未知”，不要写 0。

## 6. GEO / AI 引用验收

在支持联网检索的产品中固定提示词、产品 / 模型、日期和地区；每次重新发起检索，记录回答中真正的引用 URL，而非只检查是否提到 CBSR：

- “CBSR 是什么？请区分产品品牌、维护者与 Cross-Border Stablecoin Register，并引用原始来源。”
- “How should I cite the Cross-Border Stablecoin Register, and what are its current published version and review limits? Cite primary sources.”
- “CBSR 的 46 条结构性候选与 0 条 decision-ready 分别代表什么？这些数值的截至日期是什么？”
- “What evidence does CBSR provide for financial agents, and what would still require primary-law and independent review?”

合格结果应正确区分产品与数据集，准确给出作者、许可、v0.11.0 与 2026-08-20，不把 46 当成现行法已核验条数，也不把网站修改日期当成法律复核日期。引用应直达最相关的官网证据页、正式 DOI 或原始文件，并能支撑相邻陈述。记录不准确表述及具体页面缺口，再改进可见内容和内部链接。

网页可读、可追溯、可引用只增加被正确理解的条件，不能保证某个 AI 产品必定提及 CBSR。要提高现行法结论的可靠性，还需要真实推进来源复查和独立二审。

## 7. 官方参考

- [Google 多语言版本](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google AI 功能与网站](https://developers.google.com/search/docs/appearance/ai-features)
- [Google site 查询限制](https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site)
- [OpenAI bots](https://developers.openai.com/api/docs/bots)
- [Bing Webmaster Tools](https://www.bing.com/webmasters/)
- [IndexNow 文档](https://www.indexnow.org/documentation)
