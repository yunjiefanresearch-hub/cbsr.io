"""Source-bound, bilingual HTML evidence pages for cbsr.site.

The normal build uses only the checked-in snapshot. ``--refresh-snapshot`` copies
bytes from the explicitly pinned Git object, never the neighbouring worktree.
Nothing in this module rechecks a legal source or promotes a review status.
"""
from __future__ import annotations

from collections import Counter
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content" / "search"
SNAPSHOTS = CONTENT / "snapshots"
COMMIT = "270a002e8d66bb9971b3638dfcab52f3b2f6d2fd"
REPO = "https://github.com/yunjiefanresearch-hub/cross-border-stablecoin-register"
RAW = "https://raw.githubusercontent.com/yunjiefanresearch-hub/cross-border-stablecoin-register/" + COMMIT
AS_OF = "2026-08-20"
MODIFIED = "2026-10-17"
PAIRS = ("SG-HK", "US-EU", "EU-US", "US-HK", "HK-US", "US-JP", "JP-US", "HK-CN")
NAMES = {
    "US": ("United States", "美国", "united-states"),
    "EU": ("European Union", "欧盟", "european-union"),
    "UK": ("United Kingdom", "英国", "united-kingdom"),
    "SG": ("Singapore", "新加坡", "singapore"),
    "HK": ("Hong Kong SAR", "香港特别行政区", "hong-kong"),
    "CN": ("Mainland China", "中国内地", "mainland-china"),
    "BR": ("Brazil", "巴西", "brazil"),
    "CH": ("Switzerland", "瑞士", "switzerland"),
    "AE": ("United Arab Emirates", "阿联酋", "united-arab-emirates"),
    "TW": ("Taiwan", "台湾", "taiwan"),
    "JP": ("Japan", "日本", "japan"),
    "KR": ("South Korea", "韩国", "south-korea"),
}
DIMENSIONS = {
    "issuer_pathway": ("Issuer pathway", "发行准入路径"),
    "reserve_backing": ("Reserve and backing", "储备与资产支持"),
    "permitted_activity_yield": ("Permitted activity and yield", "允许活动与收益边界"),
    "monetary_sovereignty": ("Monetary sovereignty", "货币主权与跨境准入"),
    "aml_kyc": ("AML and KYC", "反洗钱与客户识别"),
    "bank_nonbank_routing": ("Bank and non-bank routing", "银行及非银行路由"),
    "capital_requirements": ("Capital requirements", "资本要求"),
    "cross_border_data": ("Cross-border data", "跨境数据"),
    "custody": ("Custody", "托管"),
    "disclosure_reporting": ("Disclosure and reporting", "披露与报告"),
    "distribution": ("Distribution", "分销"),
    "implementation_status": ("Implementation status", "实施状态"),
    "redemption": ("Redemption", "赎回"),
    "regulatory_authority": ("Regulatory authority", "监管机构"),
    "securities_classification": ("Securities classification", "证券属性认定"),
}
KEY_DIMENSIONS = ("issuer_pathway", "reserve_backing", "permitted_activity_yield", "monetary_sovereignty")
TERMS = {
    "in_force_enacted": "已制定并生效（快照标签）", "made_not_commenced": "已制定但未施行",
    "finalized_policy_pending": "政策已定稿，实施立法待完成", "pending_proposal": "待决提案",
    "prohibition": "禁止", "no_regime": "尚无相应制度", "operative": "已施行（快照标签）",
    "stale": "复核已逾期", "unknown": "复核时效未知", "current": "在复核期限内",
    "due_for_review": "应复核", "unreviewed": "未完成初审",
    "primary_reviewed_second_pending": "已有初审，独立复核待完成", "reconciled": "已调和复核意见",
    "official": "官方来源", "unavailable": "来源未取得", "checked": "曾检查来源",
    "not_checked": "尚未检查来源", "source_unavailable": "来源未取得",
    "tier1_legal": "法律命题", "tier2_operational": "市场或运营事实",
    "resolution_text": "一手文本层级", "firm_summary": "二手摘要层级", "mixed": "混合证据",
    "unverified": "未核验证据", "high": "高", "medium": "中", "low": "低",
    "in_force": "生效", "transitional": "过渡", "proposed": "拟议",
}


def _read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def refresh_snapshot(repository: Path | None = None) -> None:
    """Explicit maintenance operation; fail if the pinned object is unavailable."""
    repository = repository or ROOT.parent / "cross-border-stablecoin-register"
    sources = {"dataset.json": "dataset.json", "api/meta.json": "meta.json",
               "LICENSING.md": "LICENSING.md", "LICENSE-DATA": "LICENSE-DATA",
               "CITATION.cff": "CITATION.cff", "docs/PAPER_ERRATA.md": "PAPER_ERRATA.md",
               "RELEASE_MANIFEST.json": "RELEASE_MANIFEST.json",
               "papers/Citable_by_Construction_Methodology_v0.1.0.md": "papers/citable-by-construction.md",
               "papers/Cross-Border_Stablecoin_Feasibility_Over_Time_v0.1.0.md": "papers/feasibility-over-time.md",
               "docs/whitepaper/CBSR_AGENTICFI_POLICY_INFRASTRUCTURE.md": "papers/agenticfi-policy-infrastructure.md"}
    sources.update({f"api/corridors_directed/{pair}.json": f"corridors/{pair}.json" for pair in PAIRS})
    entries = []
    for source, target in sources.items():
        data = subprocess.check_output(["git", "-C", str(repository), "show", f"{COMMIT}:{source}"])
        dest = SNAPSHOTS / target
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        entries.append({"source_path": source, "local_path": f"snapshots/{target}",
                        "sha256": sha256(data).hexdigest(), "bytes": len(data),
                        "source_url": f"{REPO}/blob/{COMMIT}/{source}",
                        "license": "CC-BY-4.0" if source == "dataset.json" or source.startswith("api/") else "See source file and LICENSING.md; no new license inferred"})
    manifest = {"schema": "cbsr-search-snapshot/v1", "source_repository": REPO, "source_commit": COMMIT,
                "snapshot_as_of": AS_OF, "html_content_created": MODIFIED,
                "extraction_method": "git show <pinned-commit>:<path>; exact committed bytes",
                "data_license": "CC-BY-4.0", "code_license": "Apache-2.0",
                "author": {"name": "Yunjie Fan", "orcid": "https://orcid.org/0009-0005-6762-084X"},
                "citation_identifier_in_pinned_source": "https://doi.org/10.5281/zenodo.20730358",
                "identifier_scope_note": "Identifier copied from CITATION.cff, not a claim that every tag has its own DOI or that this HTML snapshot is a separate DOI deposit.",
                "date_scope_note": "2026-10-17 is HTML editorial creation only. Snapshot generation is 2026-08-20; individual legal analysis and source checks retain their own earlier dates.",
                "record_review_promoted": False, "files": entries}
    CONTENT.mkdir(parents=True, exist_ok=True)
    (CONTENT / "snapshot-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _verify_snapshot() -> dict:
    manifest = _read_json(CONTENT / "snapshot-manifest.json")
    if manifest["source_commit"] != COMMIT or manifest["snapshot_as_of"] != AS_OF:
        raise ValueError("Search content snapshot provenance does not match the pinned public contract")
    for entry in manifest["files"]:
        data = (CONTENT / entry["local_path"]).read_bytes()
        if sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"Search content snapshot hash mismatch: {entry['local_path']}")
    return manifest


def e(value) -> str:
    return escape(str(value), quote=True)


def choose(lang, en, zh):
    return zh if lang == "zh" else en


def term(value, lang):
    if value is None or value == "":
        return choose(lang, "Not evidenced", "无已记录证据")
    return (TERMS.get(str(value), str(value)) + " · " + str(value)) if lang == "zh" else str(value)


def link(href, label):
    return f'<a href="{e(href)}">{e(label)}</a>'


def jpath(code):
    return f"/jurisdictions/{NAMES[code][2]}/"


def cname(pair, lang):
    origin, destination = pair.split("-")
    n = 1 if lang == "zh" else 0
    return f"{NAMES[origin][n]} → {NAMES[destination][n]}"


def _header(title, description, lang, kick=None):
    return f'<article class="evidence-page"><header class="evidence-heading"><p class="kick">{e(kick or choose(lang, "CBSR · evidence library", "CBSR · 证据资料库"))}</p><h1>{e(title)}</h1><p class="lede">{e(description)}</p></header>'


def _notice(lang):
    return '<aside class="evidence-note"><strong>' + choose(lang, "Dataset edition · 20 August 2026", "数据版本 · 2026 年 8 月 20 日") + '</strong><p>' + choose(lang,
        'This edition preserves the dated regulatory analysis, source checks and review status of each record. Some legal analysis dates to June 2026. The HTML edition was prepared on 17 October 2026; record dates identify the evidence period.',
        '本版本保留各条记录的监管分析日期、来源检查日与复核状态；部分法律分析以 2026 年 6 月为基准。HTML 版编制于 2026 年 10 月 17 日，证据适用的时间范围以记录日期为准。') + '</p></aside>'


def _section(title, body):
    return f'<section><h2>{e(title)}</h2>{body}</section>'


def _p(text):
    return f"<p>{e(text)}</p>"


def _table(headers, rows):
    return '<div class="table-scroll"><table><thead><tr>' + ''.join(f'<th scope="col">{e(h)}</th>' for h in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{v}</td>' for v in row) + '</tr>' for row in rows) + '</tbody></table></div>'


def _dl(rows):
    return '<dl class="evidence-meta">' + ''.join(f'<dt>{e(k)}</dt><dd>{v}</dd>' for k, v in rows) + '</dl>'


def _related(lang, extra=()):
    entries = list(extra) + [("/data/", choose(lang, "Dataset and citation", "数据集与引用")),
               ("/jurisdictions/", choose(lang, "Jurisdiction evidence", "法域证据")),
               ("/corridors/", choose(lang, "Directed corridor evidence", "有向通道证据")),
               ("/guides/evidence-status/", choose(lang, "Evidence and review status glossary", "证据与复核状态词汇")),
               ("/method.html", choose(lang, "Methodology", "方法")),
               ("/about.html", choose(lang, "Author and accountability", "作者与责任"))]
    return '<nav aria-label="' + choose(lang, 'Related evidence', '相关证据') + '"><h2>' + choose(lang, 'Related resources', '相关资源') + '</h2><ul>' + ''.join(f'<li>{link(href, label)}</li>' for href, label in entries) + '</ul></nav></article>'


def _page(route, title, description, body, kind, structured_data=None):
    result = {"route": route, "title": title, "description": description, "body": body,
              "modified": MODIFIED, "kind": kind}
    if structured_data:
        result["structured_data"] = structured_data
    return result


def _distribution(records, field, lang):
    return "; ".join(f"{term(k, lang)}: {v}/{len(records)}" for k, v in sorted(Counter(r.get(field) or "unknown" for r in records).items()))


def _dataset_page(dataset, meta):
    titles = {"en": "Cross-Border Stablecoin Register dataset | CBSR evidence infrastructure", "zh": "Cross-Border Stablecoin Register 数据集 | CBSR 证据基础设施"}
    descriptions = {"en": "Explore 152 stablecoin regulatory records across 12 jurisdictions, with source provisions, legal status, review dates and versioned downloads. CBSR edition: 20 August 2026.", "zh": "查阅涵盖 12 个法域的 152 条稳定币监管记录，追溯来源条款、法律状态与复核日期，下载版本化数据。CBSR 数据版本：2026 年 8 月 20 日。"}
    bodies = {}
    for lang in ("en", "zh"):
        body = _header(titles[lang], descriptions[lang], lang) + _notice(lang)
        body += _section(choose(lang, "What CBSR and this dataset mean", "CBSR 与本数据集的关系"), _p(choose(lang,
            "CBSR develops evidence infrastructure for agentic finance. Its first regulatory dataset, Cross-Border Stablecoin Register, organises stablecoin rules by jurisdiction, instrument and regulatory dimension. Each record connects a regulatory proposition to its source, legal force, dates and review history.",
            "CBSR 构建面向金融智能体的证据基础设施。首个监管数据集 Cross-Border Stablecoin Register 按法域、工具与监管维度组织稳定币规则，每条记录连接监管命题、来源条款、法律效力、日期与复核历史。")))
        body += _section(choose(lang, "What is in the pinned snapshot", "固定快照包含什么"), _dl([
            (choose(lang, "Version / dataset generation", "版本 / 数据生成日"), "v0.11.0 / 2026-08-20"),
            (choose(lang, "Records / jurisdictions / dimensions", "记录 / 法域 / 维度"), f"{dataset['record_count']} / 12 / {len({r['dimension'] for r in dataset['records']})}"),
            (choose(lang, "Directed edges / authored corridor narratives", "有向边 / 已编写通道分析"), f"{meta['directed_corridors']} / {meta['authored_corridors']}"),
            (choose(lang, "Source disposition", "来源取得情况"), e(_distribution(dataset["records"], "source_disposition", lang))),
            (choose(lang, "Freshness at snapshot date", "在快照日期的复核时效"), e(_distribution(dataset["records"], "review_status", lang))),
        ]))
        rows = []
        for code, names in NAMES.items():
            records = [r for r in dataset["records"] if r["jurisdiction"] == code]
            rows.append([link(jpath(code), names[1 if lang == "zh" else 0]), str(len(records)), e(_distribution(records, "binding_status", lang))])
        body += _section(choose(lang, "Browse evidence by jurisdiction", "按法域浏览证据"), _table([choose(lang, "Jurisdiction", "法域"), choose(lang, "Records", "记录"), choose(lang, "Binding-status distribution", "效力状态分布")], rows))
        body += _section(choose(lang, "Citation, license and reproducibility", "引用、许可与复现"),
            _p(choose(lang, "Attribute the data to Yunjie Fan, Cross-Border Stablecoin Register v0.11.0, snapshot generated 20 August 2026. Preserve the record ID, source locator, source-check date and pinned commit in evidence-based use. Data is CC-BY-4.0; code is Apache-2.0. The identifier below is the one in the pinned CITATION.cff; it does not establish a separate DOI for this HTML page or every repository tag.", "数据署名应包含 Yunjie Fan、Cross-Border Stablecoin Register v0.11.0、2026 年 8 月 20 日生成的快照。基于证据使用时，保留记录 ID、来源定位、来源检查日与固定提交。数据许可为 CC-BY-4.0，代码为 Apache-2.0。以下标识来自固定版本的 CITATION.cff，不表示本 HTML 页面或每个仓库标签均有独立 DOI。")) +
            '<ul>' + ''.join(f'<li>{link(href, label)}</li>' for href, label in [
                ("/assets/search/snapshots/dataset.json", choose(lang, "Download exact committed dataset JSON", "下载已提交数据集 JSON 原始字节")),
                ("/assets/search/snapshot-manifest.json", choose(lang, "Snapshot manifest with SHA-256 hashes", "含 SHA-256 的快照清单")),
                ("/assets/search/snapshots/CITATION.cff", "CITATION.cff"),
                ("https://doi.org/10.5281/zenodo.20730358", choose(lang, "Citation identifier recorded by source", "来源记录的引用标识")),
                (f"{REPO}/tree/{COMMIT}", choose(lang, "Pinned source commit", "固定来源提交")),
                (f"{REPO}/blob/{COMMIT}/LICENSING.md", choose(lang, "Data and code license map", "数据与代码许可说明")),
            ]) + '</ul>')
        bodies[lang] = body + _related(lang)
    schema = {"@type": "Dataset", "@id": "{{BASE_URL}}/data/#dataset", "name": "Cross-Border Stablecoin Register", "alternateName": "CBSR stablecoin regulatory dataset", "description": descriptions["en"], "url": "{{BASE_URL}}/data/", "version": "0.11.0", "dateModified": AS_OF, "temporalCoverage": AS_OF,
              "license": "https://creativecommons.org/licenses/by/4.0/", "publisher": {"@id": "{{BASE_URL}}/#person"}, "inLanguage": ["en", "zh-Hans"], "creator": {"@type": "Person", "name": "Yunjie Fan", "identifier": "https://orcid.org/0009-0005-6762-084X"},
              "isBasedOn": f"{REPO}/tree/{COMMIT}", "identifier": "https://doi.org/10.5281/zenodo.20730358",
              "distribution": {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "{{BASE_URL}}/assets/search/snapshots/dataset.json"}}
    return _page("data/index.html", titles, descriptions, bodies, "dataset", schema)


def _record_card(record, lang, translations):
    source = record.get("source") or {}
    dimension = record["dimension"]
    head = DIMENSIONS.get(dimension, (dimension, dimension))[1 if lang == "zh" else 0]
    body = f'<section class="evidence-card" id="{e(record["id"])}"><h3>{e(head)}</h3><p><code>{e(record["id"])}</code></p>'
    if lang == "zh" and dimension in translations:
        body += _p(translations[dimension])
    body += '<p class="kick">' + choose(lang, 'Snapshot record wording · not a statutory quotation', '快照记录原文 · 不是法条逐字引文') + '</p><blockquote lang="en">' + e(record["requirement_summary"]) + '</blockquote>'
    rows = [
        (choose(lang, "Instrument / locator", "文件 / 定位"), e(source.get("primary") or choose(lang, "Not provided", "未提供")) + '<br>' + e(source.get("pinpoint") or choose(lang, "No pinpoint recorded", "未记录条款定位"))),
        (choose(lang, "Primary-source link", "一手来源链接"), link(source["url"], choose(lang, "Open the source recorded by CBSR", "打开 CBSR 记录的来源")) if source.get("url") else choose(lang, "Unavailable in snapshot; not inferred", "快照未取得；不补造链接")),
        (choose(lang, "Binding / legal status", "效力 / 法律状态"), e(term(record.get("binding_status"), lang)) + '<br>' + e(term(record.get("legal_status"), lang))),
        (choose(lang, "Claim / evidence tier", "命题 / 证据层级"), e(term(record.get("claim_class"), lang)) + '<br>' + e(term(record.get("evidence_tier"), lang))),
        (choose(lang, "Source disposition / check", "来源取得 / 检查状态"), e(term(record.get("source_disposition"), lang)) + '<br>' + e(term(record.get("source_check_status"), lang))),
        (choose(lang, "Last source check / next due", "最近来源检查 / 下次应复核"), e(term(record.get("source_last_checked"), lang)) + ' / ' + e(term(record.get("next_review_due"), lang))),
        (choose(lang, "Freshness / review stage", "时效 / 复核阶段"), e(term(record.get("review_status"), lang)) + '<br>' + e(term(record.get("review_stage"), lang))),
        (choose(lang, "Independent second reviewer", "独立第二复核人"), e(record.get("second_reviewer") or choose(lang, "Not recorded", "未记录"))),
        (choose(lang, "Effective from / until, as recorded", "按记录的生效起止日"), e(term(record.get("effective_from"), lang)) + ' / ' + e(term(record.get("effective_until"), lang))),
        (choose(lang, "Uncertainty", "不确定性"), e(term(record.get("uncertainty"), lang))),
        (choose(lang, "Exact committed record", "已提交记录原件"), link(f'{REPO}/blob/{COMMIT}/{record["id"]}.yaml', record["id"] + '.yaml')),
    ]
    return body + _dl(rows) + '</section>'


def _jurisdiction_pages(dataset, editorial):
    pages = []
    for code, names in NAMES.items():
        records = [r for r in dataset["records"] if r["jurisdiction"] == code]
        info = editorial["jurisdictions"][code]
        titles = {"en": f"{names[0]} stablecoin regulation evidence | CBSR historical snapshot", "zh": f"{names[1]}稳定币监管证据 | CBSR 历史快照"}
        descriptions = {"en": f"Explore {len(records)} {names[0]} stablecoin regulatory records with source locators, issuer pathways, reserve and yield rules, legal-force and review status in the 20 August 2026 CBSR snapshot.", "zh": f"浏览 {len(records)} 条{names[1]}稳定币监管记录，核对发行路径、储备、收益边界、来源定位、效力与复核状态；数据为 CBSR 2026 年 8 月 20 日历史快照。"}
        bodies = {}
        for lang in ("en", "zh"):
            body = _header(titles[lang], descriptions[lang], lang) + _notice(lang)
            body += _section(choose(lang, "Read this jurisdiction in context", "本法域应如何阅读"), _p(info[lang]))
            if info.get("caution"):
                body += '<aside class="evidence-note">' + _p(info["caution"][lang]) + '<p>' + link("/assets/search/snapshots/PAPER_ERRATA.md", choose(lang, "Read committed errata", "阅读已提交勘误")) + '</p></aside>'
            body += _section(choose(lang, "Regulatory coverage", "监管覆盖"), _dl([
                (choose(lang, "Records", "记录"), str(len(records))),
                (choose(lang, "Binding status", "效力状态"), e(_distribution(records, "binding_status", lang))),
                (choose(lang, "Evidence tier", "证据层级"), e(_distribution(records, "evidence_tier", lang))),
                (choose(lang, "Review freshness", "复核时效"), e(_distribution(records, "review_status", lang))),
                (choose(lang, "Source availability", "来源取得情况"), e(_distribution(records, "source_disposition", lang))),
            ]))
            body += '<section><h2>' + choose(lang, 'Four regulatory questions and their evidence', '四个监管问题与对应证据') + '</h2>'
            for dimension in KEY_DIMENSIONS:
                record = next((r for r in records if r["dimension"] == dimension), None)
                if record:
                    body += _record_card(record, lang, info.get("record_zh", {}))
            body += '</section>'
            rows = []
            for record in records:
                source = record.get("source") or {}
                rows.append([link(f'{REPO}/blob/{COMMIT}/{record["id"]}.yaml', DIMENSIONS.get(record["dimension"], (record["dimension"], record["dimension"]))[1 if lang == "zh" else 0]),
                             e(source.get("pinpoint") or source.get("primary") or choose(lang, "No locator", "无定位")),
                             e(term(record.get("binding_status"), lang)), e(term(record.get("review_status"), lang)),
                             e(term(record.get("source_last_checked"), lang))])
            body += _section(choose(lang, "Complete record inventory", "完整记录清单"), _table([choose(lang, "Record / dimension", "记录 / 维度"), choose(lang, "Recorded source locator", "来源定位原文"), choose(lang, "Binding status", "效力状态"), choose(lang, "Freshness", "复核时效"), choose(lang, "Source check date", "来源检查日")], rows))
            related = [(f"/corridors/{pair.lower()}/", cname(pair, lang)) for pair in PAIRS if code in pair.split("-")]
            related.append((f"{REPO}/blob/{COMMIT}/research/jurisdictions/{code}.md", choose(lang, "Committed jurisdiction evidence dossier", "已提交法域证据档案")))
            bodies[lang] = body + _related(lang, related)
        pages.append(_page(f"jurisdictions/{names[2]}/index.html", titles, descriptions, bodies, "jurisdiction"))
    titles = {"en": "Stablecoin regulation by jurisdiction | CBSR evidence directory", "zh": "按法域浏览稳定币监管 | CBSR 证据目录"}
    descriptions = {"en": "Compare stablecoin regulation across twelve jurisdictions. Explore issuer pathways, reserves, yield rules and market-access requirements with links to source records.", "zh": "比较十二个法域的稳定币监管，查阅发行准入、储备、收益规则与市场准入要求，追溯各项分析的来源记录。"}
    bodies = {}
    for lang in ("en", "zh"):
        body = _header(titles[lang], descriptions[lang], lang) + _notice(lang)
        body += '<div class="evidence-grid">'
        for code, names in NAMES.items():
            body += '<section class="evidence-card"><h2>' + link(jpath(code), names[1 if lang == "zh" else 0]) + '</h2>' + _p(editorial["jurisdictions"][code][lang]) + '</section>'
        bodies[lang] = body + '</div>' + _related(lang)
    pages.insert(0, _page("jurisdictions/index.html", titles, descriptions, bodies, "index"))
    return pages


def _corridor_pages(dataset, editorial):
    pages = []
    for pair in PAIRS:
        record = _read_json(SNAPSHOTS / "corridors" / (pair + ".json"))["data"]
        basis = record["class_basis"]
        reference = next((r for r in dataset["records"] if r["id"] == basis.get("record_ref")), None)
        titles = {"en": f"{cname(pair, 'en')} stablecoin corridor evidence | CBSR", "zh": f"{cname(pair, 'zh')}稳定币通道证据 | CBSR"}
        descriptions = {"en": f"Explore the {cname(pair, 'en')} stablecoin corridor: destination requirements, class {record['class_code']}, regulatory sources and dated analysis in the CBSR register.", "zh": f"查阅{cname(pair, 'zh')}稳定币通道：目的地准入要求、{record['class_code']} 类分析、监管来源与 CBSR 记录日期。"}
        bodies = {}
        for lang in ("en", "zh"):
            body = _header(titles[lang], descriptions[lang], lang) + _notice(lang)
            body += _section(choose(lang, "Why direction matters here", "这一方向为什么重要"), _p(editorial["corridors"][pair][lang]))
            body += _dl([(choose(lang, "Direction / currencies", "方向 / 币种"), e(cname(pair, lang)) + ' / ' + e(record.get("currencies", ""))),
                         (choose(lang, "Published class code", "公开类别代码"), e(record["class_code"])),
                         (choose(lang, "Authored analytical dateline", "原分析数据时点"), e(record.get("valid_as_of", ""))),
                         (choose(lang, "Snapshot generation", "快照生成日"), AS_OF),
                         (choose(lang, "Class rule / governing jurisdiction", "分类规则 / 主导法域"), e(basis["rule"]) + ' / ' + e(basis["governing_jurisdiction"])),
                         (choose(lang, "Evidence tier / binding status of signal", "信号的证据层级 / 效力状态"), e(term(basis["evidence_tier"], lang)) + ' / ' + e(term(basis["binding_status"], lang)))])
            body += _section(choose(lang, "Destination gate: exact snapshot wording", "目的地门槛：快照原文"), '<h3 lang="en">' + e(record["inbound_mechanism"]["test"]) + '</h3><blockquote lang="en">' + e(record["inbound_mechanism"]["detail"]) + '</blockquote>' + _p(choose(lang, "Administrator recorded by source: ", "快照记录的主管机构：") + record["inbound_mechanism"].get("administrator", "")))
            body += _section(choose(lang, "Class basis and source dependency", "分类依据与来源依赖"), '<blockquote lang="en">' + e(basis["instrument"]) + '</blockquote>' + _dl([
                (choose(lang, "Signal", "信号"), e(basis["signal"]) + ' = ' + e(basis["signal_value"])),
                (choose(lang, "Dependent record", "依赖记录"), link(jpath(record["destination"]) + '#' + str(basis.get("record_ref", "")), basis.get("record_ref", ""))),
                (choose(lang, "Underlying source check / review state", "底层来源检查 / 复核状态"), e(term(reference.get("source_last_checked") if reference else None, lang)) + ' / ' + e(term(reference.get("review_status") if reference else None, lang))),
            ]))
            divergence = basis.get("record_ref_meta", {}).get("divergence")
            if divergence:
                body += '<aside class="evidence-note"><h3>' + choose(lang, 'Declared source-record / gate distinction', '已声明的记录与门槛差异') + '</h3><p lang="en">' + e(divergence) + '</p><p>' + choose(lang, 'Act enactment does not itself establish that this inbound section has commenced.', '法案制定并不自动证明该跨境准入条款已施行。') + '</p></aside>'
            if record.get("origin_override"):
                body += _section(choose(lang, "Origin-side constraint", "来源地附加约束"), '<blockquote lang="en">' + e(record["origin_override"].get("basis", "")) + '</blockquote>')
            if record.get("divergence"):
                body += _section(choose(lang, "Directed edge versus undirected pair", "有向边与无向配对的区别"), _p(choose(lang, "The source explicitly distinguishes pairwise interaction sets from this directed edge. Direction-specific interaction sets are ", "来源明确区分无向配对与有向边的约束交互集。本方向的交互集为 ") + ', '.join(record.get("interaction_sets", []))) + '<p lang="en">' + e(record["divergence"]["reason"]) + '</p>')
            source_url = reference.get("source", {}).get("url") if reference else None
            sources = '<ul><li>' + link(f"/assets/search/snapshots/corridors/{pair}.json", choose(lang, "Exact committed corridor JSON", "已提交通道 JSON 原始文件")) + '</li><li>' + link(f'{REPO}/blob/{COMMIT}/{record["authored_source_file"]}', choose(lang, "Authored corridor source", "通道分析源文件")) + '</li>'
            if source_url:
                sources += '<li>' + link(source_url, choose(lang, "Underlying regulatory source recorded by CBSR", "CBSR 记录的底层监管来源")) + '</li>'
            sources += '<li lang="en">' + e(record.get("source", {}).get("primary", "")) + '</li><li lang="en">' + e(record.get("source", {}).get("secondary", "")) + '</li></ul>'
            body += _section(choose(lang, "Sources and limits", "来源与局限"), sources + _p(choose(lang, "An authored narrative or infrastructure pilot does not certify operational access. The class is a dated research output, not a licence, execution approval or guarantee of settlement availability. Source-review gaps remain visible in the linked jurisdiction records.", "分析叙述或基础设施试验不证明已经取得业务准入。类别属于有日期的研究输出，不是牌照、执行批准或结算可用性保证。来源复核缺口继续保留在关联的法域记录中。")))
            reverse = '-'.join(reversed(pair.split('-')))
            extra = [(jpath(record["origin"]), NAMES[record["origin"]][1 if lang == "zh" else 0]), (jpath(record["destination"]), NAMES[record["destination"]][1 if lang == "zh" else 0])]
            if reverse in PAIRS:
                extra.append((f"/corridors/{reverse.lower()}/", choose(lang, "Read the reverse direction: ", "比较反向：") + cname(reverse, lang)))
            bodies[lang] = body + _related(lang, extra)
        pages.append(_page(f"corridors/{pair.lower()}/index.html", titles, descriptions, bodies, "corridor"))
    titles = {"en": "Directed stablecoin corridor evidence | CBSR source library", "zh": "有向稳定币通道证据 | CBSR 来源资料库"}
    descriptions = {"en": "Compare eight directed stablecoin corridors, their destination requirements and regulatory sources. Trace how a change in direction changes the market-access analysis.", "zh": "比较八条有向稳定币通道的目的地准入要求与监管来源，理解方向变化如何影响市场准入分析。"}
    bodies = {}
    for lang in ("en", "zh"):
        body = _header(titles[lang], descriptions[lang], lang) + _notice(lang)
        body += _p(choose(lang, "These are eight selected narratives from a snapshot containing nine authored corridors and 132 directed edges. The selection is an evidence-reading route, not a claim of exhaustive corridor analysis. Compare both directions where linked: the destination gate can change the class even for the same pair of jurisdictions.", "本页从含九个已编写通道分析、132 条有向边的快照中选择八例。它是证据阅读路径，不代表已穷尽全部通道。对于有反向链接的例子，应同时比较：相同两地之间，目的地门槛仍可能改变类别。"))
        body += '<div class="evidence-grid">' + ''.join('<section class="evidence-card"><h2>' + link(f'/corridors/{pair.lower()}/', cname(pair, lang)) + '</h2>' + _p(editorial["corridors"][pair][lang]) + '</section>' for pair in PAIRS) + '</div>'
        bodies[lang] = body + _related(lang)
    pages.insert(0, _page("corridors/index.html", titles, descriptions, bodies, "index"))
    return pages


def _research_pages(editorial):
    pages = []
    for paper in editorial["papers"]:
        titles = {lang: paper["title"] + choose(lang, " | CBSR research summary", " | CBSR 研究摘要") for lang in ("en", "zh")}
        descriptions = {lang: paper["summary"][lang] for lang in ("en", "zh")}
        bodies = {}
        for lang in ("en", "zh"):
            body = _header(titles[lang], descriptions[lang], lang, choose(lang, "CBSR · research", "CBSR · 研究"))
            body += '<aside class="evidence-note">' + _p(paper["status"][lang]) + '</aside>'
            body += _dl([(choose(lang, "Author", "作者"), link("https://orcid.org/0009-0005-6762-084X", "Yunjie Fan · ORCID 0009-0005-6762-084X")),
                         (choose(lang, "Original dateline / version", "原文日期 / 版本"), e(paper["dateline"])),
                         (choose(lang, "HTML summary creation", "HTML 摘要创建日"), MODIFIED)])
            for section in paper["sections"]:
                body += _section(section["heading"][lang], _p(section["body"][lang]))
            body += _section(choose(lang, "Read and cite the original", "阅读并引用原文"), '<ul>' + ''.join('<li>' + link(item["url"], item["label"][lang]) + '</li>' for item in paper["sources"]) + '</ul>' + _p(choose(lang, "Cite the original text with its version and publication date. This HTML summary provides a reading guide to that edition; the linked manuscript records the full argument and research context.", "引用原文时，请注明版本与发布日期。本 HTML 摘要提供相应版本的阅读指引；完整论证与研究背景请见所链接的论文原文。")))
            bodies[lang] = body + _related(lang, [("/research/", choose(lang, "Research summary library", "研究摘要目录")), ("/research.html", choose(lang, "Full research and policy index", "完整研究与政策索引"))])
        schema = {"@type": "ScholarlyArticle", "headline": paper["title"], "url": "{{BASE_URL}}/research/" + paper["slug"] + "/", "author": {"@type": "Person", "name": "Yunjie Fan", "identifier": "https://orcid.org/0009-0005-6762-084X"}, "isBasedOn": [s["url"] for s in paper["sources"]], "creativeWorkStatus": paper["schema_status"], "description": paper["summary"]["en"]}
        pages.append(_page(f'research/{paper["slug"]}/index.html', titles, descriptions, bodies, "research", schema))
    titles = {"en": "CBSR research summaries and source texts", "zh": "CBSR 研究摘要与原文"}
    descriptions = {"en": "Read source-bound HTML summaries of CBSR evidence methodology, dated corridor transitions, AgenticFi policy infrastructure and the Section 404 policy brief.", "zh": "阅读 CBSR 证据方法、带日期的通道转变、金融智能体政策基础设施与 Section 404 政策简报的 HTML 摘要及原文。"}
    bodies = {}
    for lang in ("en", "zh"):
        body = _header(titles[lang], descriptions[lang], lang)
        body += _p(choose(lang, "Explore CBSR's methodology, corridor analysis and policy research. Each entry includes the research question, principal contribution, publication date and original text. Policy submissions represent the author's proposals.", "查阅 CBSR 的方法论文、通道分析与政策研究。每项材料列明研究问题、主要贡献、发布日期与原文链接；政策提交材料代表作者的研究建议。"))
        body += '<div class="evidence-grid">' + ''.join('<section class="evidence-card"><h2>' + link(f'/research/{paper["slug"]}/', paper["title"]) + '</h2>' + _p(paper["summary"][lang]) + '</section>' for paper in editorial["papers"]) + '</div>'
        bodies[lang] = body + _related(lang, [("/research.html", choose(lang, "Full research and policy index", "完整研究与政策索引"))])
    pages.insert(0, _page("research/index.html", titles, descriptions, bodies, "index"))
    return pages


def _guide_pages(editorial):
    pages = []
    for guide in editorial["guides"]:
        bodies = {}
        for lang in ("en", "zh"):
            body = _header(guide["title"][lang], guide["description"][lang], lang)
            for section in guide["sections"]:
                body += _section(section["heading"][lang], _p(section["body"][lang]))
            if guide["slug"] == "evidence-status":
                rows = [(e(key), e(choose(lang, en, zh))) for key, en, zh in [
                    ("claim_class", "What kind of claim is made: law versus operational observation.", "命题种类：法律命题或运营观察。"),
                    ("evidence_tier", "Strength of provenance; it does not establish legal force.", "来源证据强度，不证明法律效力。"),
                    ("binding_status", "Instrument force: operative, not commenced, policy, proposal, prohibition or no regime.", "文件效力：施行、未施行、政策、提案、禁止或无制度。"),
                    ("source_last_checked", "Date of an evidenced source check. A page edit date is not a substitute.", "有证据的来源检查日期，不能用网页编辑日代替。"),
                    ("review_status", "Freshness relative to the explicit as-of date, not an independent legal opinion.", "相对于明确截止日的复核时效，不是独立法律意见。"),
                    ("review_stage", "Primary and independent second review are separate, recorded events.", "初审与独立第二复核是分别记录的事件。"),
                    ("structural_candidate", "An inventory filter for records that meet the structural evidence requirements.", "按结构性证据要求筛选记录的清单字段。"),
                    ("decision_ready", "A review gate that combines evidence structure, currentness and reconciled independent review.", "综合证据结构、时效与独立调和复核的审查字段。"),
                    ("execution_authorized", "Always false at the CBSR decision-support boundary.", "CBSR 决策支持边界始终为 false。"),
                ]]
                body += _table([choose(lang, "Field or concept", "字段或概念"), choose(lang, "Meaning", "含义")], rows)
            body += '<ul>' + ''.join('<li>' + link(source["url"], source["label"][lang]) + '</li>' for source in guide["sources"]) + '</ul>'
            bodies[lang] = body + _related(lang)
        pages.append(_page(f'guides/{guide["slug"]}/index.html', guide["title"], guide["description"], bodies, "guide"))
    return pages


def build_pages() -> list[dict]:
    """Return complete bilingual, main-inner HTML content; no filesystem mutation."""
    _verify_snapshot()
    dataset = _read_json(SNAPSHOTS / "dataset.json")
    meta = _read_json(SNAPSHOTS / "meta.json")["data"]
    if dataset["record_count"] != 152 or len(dataset["records"]) != 152 or meta["review_coverage"]["decision_ready"] != 0 or meta["structural_citable_candidates"] != 46:
        raise ValueError("Unexpected data contract; review source and content rather than silently promoting claims")
    editorial = _read_json(CONTENT / "editorial.json")
    pages = [_dataset_page(dataset, meta)] + _jurisdiction_pages(dataset, editorial) + _corridor_pages(dataset, editorial) + _research_pages(editorial) + _guide_pages(editorial)
    routes = [page["route"] for page in pages]
    if len(routes) != len(set(routes)):
        raise ValueError("Duplicate search-content route")
    return pages


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh-snapshot", action="store_true")
    args = parser.parse_args()
    if args.refresh_snapshot:
        refresh_snapshot()
    result = build_pages()
    print(json.dumps({"pages": len(result), "languages": ["en", "zh"], "source_commit": COMMIT, "snapshot_as_of": AS_OF, "html_created": MODIFIED, "routes": [p["route"] for p in result]}, ensure_ascii=False, indent=2))
