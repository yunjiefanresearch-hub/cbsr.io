#!/usr/bin/env python3
"""Validate the public search artifact, not just its source templates (stdlib only)."""

from __future__ import annotations

import argparse
import base64
from datetime import date
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "xhtml": "http://www.w3.org/1999/xhtml"}
FORBIDDEN_PARTS = {".git", ".github", ".contract", "tools", "docs", "content", "node_modules", "__pycache__", "test-results"}
PUBLIC_ROOT_FILES = {"favicon.svg", "og-card.png", ".nojekyll", "CNAME", "robots.txt", "sitemap.xml", "llms.txt", "build-manifest.json"}
CJK = re.compile(r"[\u3400-\u9fff]")


class Document(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.lang = ""
        self.title = []
        self.description = []
        self.canonical = []
        self.alternates = {}
        self.ids = set()
        self.duplicate_ids = []
        self.links = []
        self.resources = []
        self.robots = []
        self.og = {}
        self.scripts = []
        self.script_hashes = []
        self.csp = ""
        self.inputs = {}
        self.text = []
        self.live = {}
        self._hidden = 0
        self._title = False
        self._json = None
        self._live = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        if tag == "html":
            self.lang = attr.get("lang", "")
        if tag in {"script", "style"}:
            self._hidden += 1
        if tag == "title":
            self._title = True
        if attr.get("id"):
            if attr["id"] in self.ids:
                self.duplicate_ids.append(attr["id"])
            self.ids.add(attr["id"])
        if tag == "a" and "href" in attr:
            self.links.append(attr["href"])
        if tag == "link":
            rel = attr.get("rel", "").split()
            if "canonical" in rel:
                self.canonical.append(attr.get("href", ""))
            if "alternate" in rel and attr.get("hreflang"):
                key = attr["hreflang"]
                if key in self.alternates:
                    raise AssertionError(f"duplicate hreflang: {key}")
                self.alternates[key] = attr.get("href", "")
            if set(rel) & {"stylesheet", "icon"}:
                self.resources.append(attr.get("href", ""))
        if tag == "meta":
            if attr.get("http-equiv", "").lower() == "content-security-policy":
                self.csp = attr.get("content", "")
            if attr.get("name") == "description":
                self.description.append(attr.get("content", ""))
            if attr.get("name") == "robots":
                self.robots.append(attr.get("content", ""))
            if attr.get("property", "").startswith("og:"):
                self.og[attr["property"]] = attr.get("content", "")
        if tag in {"script", "img", "source", "iframe"} and attr.get("src"):
            self.resources.append(attr["src"])
        if tag == "form" and attr.get("action"):
            self.resources.append(attr["action"])
        if tag == "input" and attr.get("name"):
            self.inputs[attr["name"]] = attr.get("value", "")
        if tag == "script" and attr.get("type") == "application/ld+json":
            self._json = []
        if "data-live" in attr:
            self._live.append([tag, attr["data-live"], []])

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self._hidden = max(0, self._hidden - 1)
        if tag == "title":
            self._title = False
        if tag == "script" and self._json is not None:
            script = "".join(self._json)
            self.scripts.append(json.loads(script))
            self.script_hashes.append(base64.b64encode(hashlib.sha256(script.encode("utf-8")).digest()).decode("ascii"))
            self._json = None
        if self._live and tag == self._live[-1][0]:
            _, name, pieces = self._live.pop()
            self.live.setdefault(name, []).append("".join(pieces).strip())

    def handle_data(self, data):
        if self._title:
            self.title.append(data)
        if self._json is not None:
            self._json.append(data)
        if not self._hidden:
            self.text.append(data)
        for item in self._live:
            item[2].append(data)


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def canonical_url(base, relative):
    route = relative[:-len("index.html")] if relative.endswith("index.html") else relative
    return urljoin(base, route)


def schema_nodes(value):
    if isinstance(value, dict):
        if "@type" in value:
            yield value
        for child in value.values():
            yield from schema_nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from schema_nodes(child)


def types(node):
    value = node.get("@type", [])
    return set(value if isinstance(value, list) else [value])


def validate_site(directory: Path, base: str):
    require(directory.is_dir(), f"missing built artifact: {directory}")
    origin = urlsplit(base)
    require(origin.scheme == "https" and origin.netloc and base.endswith("/"), "base URL must be absolute HTTPS with trailing slash")
    paths = sorted(directory.rglob("*"))
    files = [p for p in paths if p.is_file()]
    file_names = {p.relative_to(directory).as_posix() for p in files}
    require(files, "empty output")
    for item in paths:
        rel = item.relative_to(directory)
        require(not item.is_symlink(), f"public artifact contains symlink: {rel}")
        require(not (set(rel.parts) & FORBIDDEN_PARTS), f"build/source directory leaked: {rel}")
        require(item.suffix.lower() not in {".py", ".pyc", ".mjs", ".toml", ".yml", ".yaml", ".env", ".ps1", ".cmd", ".bat", ".sh", ".pem", ".key"}, f"private build input leaked: {rel}")
        require(not item.name.startswith(".env"), f"environment file leaked: {rel}")
        require("mica-review-questionnaire-2026.pdf" not in rel.as_posix().lower(), f"private evidence file leaked: {rel}")
        if item.is_file():
            require(rel.parts[0] in {"assets", "papers", "zh"} or item.suffix == ".html" or (len(rel.parts) == 1 and item.name in PUBLIC_ROOT_FILES), f"unintended public root input: {rel}")
    manifest_source = (directory / "build-manifest.json").read_text(encoding="utf-8")
    require(not re.search(r"[A-Za-z]:\\\\|/Users/|/home/runner/|file://", manifest_source), "manifest exposes a machine path")
    manifest = json.loads(manifest_source)
    require(manifest.get("base_url") == base and manifest.get("schema_version") == 1, "manifest base/schema mismatch")
    snapshot = manifest.get("snapshot", {})
    require(snapshot.get("version") == "0.11.0" and snapshot.get("as_of") == "2026-08-20" and snapshot.get("source_commit") == "270a002e8d66bb9971b3638dfcab52f3b2f6d2fd", "manifest snapshot identity drift")
    for relative, expected_hash in manifest.get("static_files_sha256", {}).items():
        public_file = (directory / relative).resolve()
        require(public_file.is_relative_to(directory.resolve()) and public_file.is_file(), f"manifest checksum references absent/nonpublic file: {relative}")
        require(hashlib.sha256(public_file.read_bytes()).hexdigest() == expected_hash, f"public file differs from manifest: {relative}")
    docs = {}
    all_sources = []
    for file in files:
        rel = file.relative_to(directory).as_posix()
        if file.suffix.lower() in {".html", ".xml", ".txt", ".json", ".js", ".css"}:
            source = file.read_text(encoding="utf-8")
            # cbsr.js retains an explicit template-preview fallback token as code;
            # it is never a published metadata URL. Inspect all URL-bearing docs.
            if file.suffix.lower() != ".js":
                require("__SITE_URL__" not in source and "{{BASE_URL}}" not in source, f"URL placeholder survived in {rel}")
            require("mica-review-questionnaire-2026.pdf" not in source, f"private evidence leaked in {rel}")
            require(not re.search(r"(?:receipt[_-]?id|csrf(?:token)?|session[_-]?token)=", source, re.I), f"private session field leaked in {rel}")
        if file.suffix.lower() == ".html":
            doc = Document(source)
            docs[rel] = doc
            all_sources.append(source)
    require("index.html" in docs and "zh/index.html" in docs, "both home languages must be published")
    sitemap = ET.parse(directory / "sitemap.xml").getroot()
    manifest_pages = {p["canonical"]: p for p in manifest.get("pages", [])}
    sitemap_urls = []
    for node in sitemap.findall("s:url", NS):
        location = node.findtext("s:loc", "", NS)
        stamp = node.findtext("s:lastmod", "", NS)
        require(re.fullmatch(r"\d{4}-\d{2}-\d{2}", stamp), f"missing/invalid sitemap lastmod: {location}")
        require(date.fromisoformat(stamp).isoformat() == stamp, f"invalid calendar date: {location}")
        require(location in manifest_pages and stamp == manifest_pages[location]["last_modified"], f"sitemap date differs from publication manifest: {location}")
        alternates = {link.attrib.get("hreflang"): link.attrib.get("href") for link in node.findall("xhtml:link", NS)}
        route = manifest_pages[location]["source_route"]
        require(alternates == {"en": canonical_url(base, route), "zh-Hans": canonical_url(base, "zh/" + route), "x-default": canonical_url(base, route)}, f"sitemap language links disagree with HTML: {location}")
        sitemap_urls.append(location)
    require(len(sitemap_urls) == len(set(sitemap_urls)), "duplicate sitemap entries")
    robots = (directory / "robots.txt").read_text(encoding="utf-8")
    require(f"Sitemap: {urljoin(base, 'sitemap.xml')}" in robots, "robots sitemap must match configured origin/path")
    require(not re.search(r"^Disallow:\s*/\s*$", robots, re.M | re.I), "robots blocks whole site")
    require((directory / ".nojekyll").is_file(), "missing .nojekyll")
    by_url = {canonical_url(base, rel): (rel, doc) for rel, doc in docs.items()}
    expected_indexed = set()
    dataset_count = 0
    for rel, doc in docs.items():
        own = canonical_url(base, rel)
        zh = rel.startswith("zh/")
        noindex = any("noindex" in value.lower() for value in doc.robots)
        require(doc.canonical == [own], f"{rel}: canonical must appear once and equal {own}: {doc.canonical}")
        require(doc.lang == ("zh-Hans" if zh else "en"), f"{rel}: incorrect html lang {doc.lang}")
        require(len(doc.description) == 1 and doc.description[0].strip(), f"{rel}: exactly one meaningful meta description required")
        require("".join(doc.title).strip(), f"{rel}: missing title")
        require(not doc.duplicate_ids, f"{rel}: duplicate ids {doc.duplicate_ids}")
        require(doc.og.get("og:url") == own, f"{rel}: og:url disagrees with canonical")
        require(doc.og.get("og:site_name") == "CBSR", f"{rel}: product brand must be CBSR")
        image = doc.og.get("og:image", "")
        require(image == urljoin(base, "og-card.png"), f"{rel}: social image ignores base URL")
        if rel.split("/")[-1] in {"404.html", "thanks.html"}:
            require(noindex and own not in sitemap_urls, f"{rel}: utility page must be noindex and excluded from sitemap")
        else:
            require(not noindex, f"{rel}: substantive page unexpectedly noindex")
            expected_indexed.add(own)
            en_rel = rel[3:] if zh else rel
            expected = {"en": canonical_url(base, en_rel), "zh-Hans": canonical_url(base, "zh/" + en_rel), "x-default": canonical_url(base, en_rel)}
            require(doc.alternates == expected, f"{rel}: incomplete or incorrect hreflang pair {doc.alternates}")
            for language, target in expected.items():
                require(target in by_url, f"{rel}: alternate {language} missing from artifact")
                other = by_url[target][1]
                require(other.alternates == expected, f"{rel}: hreflang link is not reciprocal at {target}")
            alternate = expected["en"] if zh else expected["zh-Hans"]
            require(alternate in {urljoin(own, href) for href in doc.links}, f"{rel}: language selector must be a crawlable alternate link")
        text = " ".join(doc.text)
        if zh:
            require(len(CJK.findall(text)) >= 40, f"{rel}: Chinese body is missing before JavaScript runs")
            require(CJK.search("".join(doc.title)) and CJK.search(doc.description[0]), f"{rel}: Chinese title/description missing")
        require(doc.scripts or noindex, f"{rel}: missing JSON-LD entity graph")
        require(all("'sha256-" + checksum + "'" in doc.csp for checksum in doc.script_hashes), f"{rel}: CSP blocks the JSON-LD script")
        nodes = [node for script in doc.scripts for node in schema_nodes(script)]
        node_ids = {node.get("@id"): node for node in nodes if node.get("@id")}
        all_types = set().union(*(types(n) for n in nodes)) if nodes else set()
        if not noindex:
            require({"Person", "WebSite", "WebPage", "BreadcrumbList"} <= all_types, f"{rel}: incomplete entity graph: {all_types}")
            people = [n for n in nodes if "Person" in types(n)]
            require(any(n.get("name") == "Yunjie Fan" and "0009-0005-6762-084X" in json.dumps(n) for n in people), f"{rel}: actual author identity/ORCID missing")
            for website in (n for n in nodes if "WebSite" in types(n)):
                publisher = website.get("publisher", {})
                require(isinstance(publisher, dict) and publisher.get("@id") in node_ids and "Person" in types(node_ids[publisher["@id"]]), f"{rel}: website publisher must resolve to maintainer")
            pages = [n for n in nodes if "WebPage" in types(n)]
            require(any(n.get("url") == own and n.get("inLanguage") == doc.lang for n in pages), f"{rel}: WebPage URL/language mismatch")
        for node in nodes:
            # Downloads advertised to machines must resolve just like visible links.
            for field in ("url", "contentUrl"):
                if isinstance(node.get(field), str):
                    doc.resources.append(node[field])
            if "Dataset" in types(node):
                dataset_count += 1
                require(node.get("name") == "Cross-Border Stablecoin Register", f"{rel}: dataset formal title drift")
                require(str(node.get("version", "")).lstrip("v") == "0.11.0", f"{rel}: dataset version differs from source snapshot")
                license_value = json.dumps(node.get("license", ""))
                require("creativecommons.org/licenses/by/4.0" in license_value or "CC-BY-4.0" in license_value, f"{rel}: data licence must be CC-BY-4.0")
                require("Apache" not in license_value, f"{rel}: software licence incorrectly assigned to data")
                publisher = node.get("publisher", {})
                require(isinstance(publisher, dict) and (publisher.get("@id") in node_ids or publisher.get("name") == "Yunjie Fan"), f"{rel}: Dataset publisher must identify actual maintainer")
                require("2026-08-20" in json.dumps(node), f"{rel}: dataset schema lost snapshot date")
    require(dataset_count >= 2, "both languages must expose the Dataset schema")
    require(set(sitemap_urls) == expected_indexed, f"sitemap differs from indexable HTML (missing={expected_indexed-set(sitemap_urls)}, extra={set(sitemap_urls)-expected_indexed})")
    for rel, doc in docs.items():
        own = canonical_url(base, rel)
        for href in doc.links + doc.resources:
            if not href or href.startswith(("mailto:", "tel:", "data:", "javascript:")):
                require(not href.startswith("javascript:"), f"{rel}: javascript link instead of crawlable URL")
                continue
            resolved = urlsplit(urljoin(own, href))
            if resolved.scheme not in {"http", "https"} or resolved.netloc != origin.netloc:
                continue
            require(resolved.scheme == origin.scheme, f"{rel}: local link downgrades HTTPS: {href}")
            require(resolved.path.startswith(origin.path), f"{rel}: internal link escapes configured project base: {href}")
            local = unquote(resolved.path[len(origin.path):])
            require(not local.startswith("/") and "\\" not in local and not ({".", ".."} & set(PurePosixPath(local).parts)), f"{rel}: link escapes output: {href}")
            target_rel = local + "index.html" if resolved.path.endswith("/") or not local else local
            require(target_rel in file_names, f"{rel}: missing internal link/resource {href} (resolved {local})")
            if resolved.fragment and target_rel.endswith(".html"):
                require(unquote(resolved.fragment) in docs[target_rel].ids, f"{rel}: missing fragment target {href}")
    for rel in ("index.html", "zh/index.html"):
        doc = docs[rel]
        body = " ".join(doc.text)
        require("CBSR" in body and "Cross-Border Stablecoin Register" in body, f"{rel}: product/dataset identity missing")
        require(re.search(r"agentic finance|金融智能体|智能体金融", body, re.I), f"{rel}: product purpose missing")
        require("0" in doc.live.get("decision_ready", []), f"{rel}: strict count must remain zero in static body")
        require("46" in doc.live.get("structural_candidates", []), f"{rel}: structural candidates must remain 46")
        require("152" in doc.live.get("records", []), f"{rel}: snapshot record count drift")
        require("103" in doc.live.get("official_source", []) and "41" in doc.live.get("primary_reviewed", []) and "0" in doc.live.get("reconciled", []), f"{rel}: review/source boundary lost")
    require("46 records" not in "\n".join(all_sources), "structural candidates promoted to strict records")
    for rel in ("maintain.html", "zh/maintain.html"):
        require(rel in docs, f"{rel}: maintainer application page is missing")
        doc = docs[rel]
        require({"apply", "apply-mailto"} <= doc.ids, f"{rel}: maintainer application controls missing")
        require({"_honey", "_next"} <= set(doc.inputs), f"{rel}: maintainer application field contract lost")
        redirect = doc.inputs["_next"]
        require(redirect in {urljoin(base, "thanks.html"), urljoin(base, "zh/thanks.html")}, f"{rel}: form redirect must be an absolute deployed thanks URL")
        require(redirect in by_url, f"{rel}: form redirect target is absent")
    print(f"OK: {len(docs)} static HTML pages, {len(sitemap_urls)} indexable URLs; reciprocal languages, schema, sources, links, and publication boundary verified", flush=True)


def digest(directory):
    return {p.relative_to(directory).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.rglob("*") if p.is_file()}


def run_builder(output, base):
    return subprocess.run([sys.executable, str(ROOT / "tools" / "build_search_site.py"), "--base-url", base, "--output", str(output)], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")


def validate_build_contract(base):
    with tempfile.TemporaryDirectory(prefix="_site-validation-", dir=ROOT) as temporary:
        parent = Path(temporary)
        first, second, project = parent / "one", parent / "two", parent / "project"
        for output in (first, second):
            process = run_builder(output, base)
            require(process.returncode == 0, f"repeat build failed: {process.stdout}\n{process.stderr}")
        require(digest(first) == digest(second), "same inputs produce different bytes")
        parsed = urlsplit(base)
        project_base = urlunsplit((parsed.scheme, parsed.netloc, "/preview/cbsr/", "", ""))
        process = run_builder(project, project_base)
        require(process.returncode == 0, f"project-path build failed: {process.stdout}\n{process.stderr}")
        validate_site(project, project_base)
        for unsafe in (ROOT, ROOT / "tools", ROOT / "assets", ROOT.parent / (parent.name + "-outside")):
            process = run_builder(unsafe, base)
            require(process.returncode != 0, f"unsafe output accepted: {unsafe}")
        # Exercise symlink rejection where the host allows symlink creation.
        target = parent / "sentinel"
        target.mkdir()
        (target / "keep.txt").write_text("must survive", encoding="utf-8")
        link = parent / "linked-output"
        try:
            link.symlink_to(target, target_is_directory=True)
        except (OSError, NotImplementedError):
            print("NOTE: symlink fixture unavailable on this host; rejection is exercised on Linux CI")
        else:
            process = run_builder(link, base)
            require(process.returncode != 0 and (target / "keep.txt").read_text(encoding="utf-8") == "must survive", "builder followed a symlink output")
            link.unlink()
    print("OK: repeated builds are byte-stable; project-path deployment and unsafe-output rejection verified", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-dir", type=Path, default=ROOT / "_site")
    parser.add_argument("--base-url", default="https://cbsr.site/")
    parser.add_argument("--skip-build-contracts", action="store_true", help="only inspect an already-built artifact")
    args = parser.parse_args()
    base = args.base_url.rstrip("/") + "/"
    validate_site(args.site_dir.resolve(), base)
    if not args.skip_build_contracts:
        validate_build_contract(base)


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, ValueError, OSError, ET.ParseError) as error:
        print(f"SEARCH ARTIFACT CHECK FAILED: {error}", file=sys.stderr)
        sys.exit(1)
