#!/usr/bin/env python3
"""Build the allowlisted, bilingual CBSR publication using only the standard library.

Root HTML remains the editable English source. Translations are materialized before
publication, so a crawler (and a reader without JavaScript) receives the same text.
Run: python tools/build_search_site.py --base-url https://cbsr.site/ --output _site
"""
from __future__ import annotations

import argparse
import base64
import copy
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
VOID = frozenset("area base br col embed hr img input link meta param source track wbr".split())
STATIC_FILES = ("favicon.svg", "og-card.png", ".nojekyll")
STATIC_DIRECTORIES = ("assets", "papers")
ORCID = "https://orcid.org/0009-0005-6762-084X"
REGISTER_URL = "https://github.com/yunjiefanresearch-hub/cross-border-stablecoin-register"
SNAPSHOT_COMMIT = "270a002e8d66bb9971b3638dfcab52f3b2f6d2fd"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
XHTML_NS = "http://www.w3.org/1999/xhtml"


class Node:
    """A small lossless-text HTML tree; entities and script/style data stay raw."""

    def __init__(self, tag=None, attrs=None, children=None, raw=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.children = list(children or [])
        self.raw = raw

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()

    def first(self, tag):
        return next((node for node in self.walk() if node.tag == tag), None)

    def render(self):
        if self.raw is not None:
            return self.raw
        inside = "".join(child.render() for child in self.children)
        if self.tag is None:
            return inside
        attrs = "".join(
            " " + name if value is None else ' ' + name + '="' + html.escape(str(value), quote=True) + '"'
            for name, value in self.attrs.items()
        )
        start = "<" + self.tag + attrs + ">"
        return start if self.tag in VOID else start + inside + "</" + self.tag + ">"


class TreeParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, attrs))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return
        # Keep an unmatched closing tag rather than silently discarding source.
        self.stack[-1].children.append(Node(raw="</" + tag + ">"))

    def handle_data(self, data):
        self.stack[-1].children.append(Node(raw=data))

    def handle_entityref(self, name):
        self.handle_data("&" + name + ";")

    def handle_charref(self, name):
        self.handle_data("&#" + name + ";")

    def handle_comment(self, data):
        self.handle_data("<!--" + data + "-->")

    def handle_decl(self, decl):
        self.handle_data("<!" + decl + ">")

    def handle_pi(self, data):
        self.handle_data("<?" + data + ">")


def parse_html(source):
    parser = TreeParser()
    parser.feed(source)
    parser.close()
    return parser.root


def text_node(text):
    return Node(raw=html.escape(str(text), quote=False))


def node_text(node):
    if node is None:
        return ""
    return html.unescape(re.sub(r"<[^>]+>", "", node.render())).strip()


def translate(node, language):
    if language == "zh":
        if "data-zh" in node.attrs:
            node.children = parse_html(node.attrs["data-zh"]).children
        for name, value in list(node.attrs.items()):
            if name.startswith("data-zh-"):
                node.attrs[name[len("data-zh-"):]] = value
    for name in list(node.attrs):
        if name == "data-zh" or name.startswith("data-zh-") or name.startswith("data-title-"):
            del node.attrs[name]
    for child in node.children:
        translate(child, language)


def replace_node(parent, original, replacement):
    for index, child in enumerate(parent.children):
        if child is original:
            parent.children[index:index + 1] = replacement
            return True
        if replace_node(child, original, replacement):
            return True
    return False


def normalize_base_url(value):
    parts = urlsplit(value)
    if parts.scheme not in {"https", "http"} or not parts.hostname:
        raise ValueError("--base-url must be an absolute http(s) URL")
    if parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("--base-url cannot contain credentials, query parameters, or a fragment")
    if "\\" in value or any(part in {".", ".."} for part in parts.path.split("/")):
        raise ValueError("--base-url must have a normalized URL path")
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/") + "/", "", ""))


def validate_output(value):
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    # Validate the lexical path and every existing component before resolving it.
    # This rejects a symlink/junction even when its target happens to be in ROOT.
    try:
        relative = candidate.absolute().relative_to(ROOT)
    except ValueError as error:
        raise ValueError("--output must be inside this project") from error
    if not relative.parts or any(part in {".", ".."} for part in relative.parts):
        raise ValueError("--output cannot be the project root or contain traversal")
    if not relative.parts[0].startswith("_"):
        raise ValueError("--output must use a dedicated build directory beginning with '_' (for example _site)")
    check = ROOT
    for part in relative.parts:
        check = check / part
        if check.is_symlink() or (hasattr(check, "is_junction") and check.is_junction()):
            raise ValueError("--output cannot contain symlinks or junctions")
    target = candidate.resolve()
    if not target.is_relative_to(ROOT.resolve()) or target == ROOT.resolve():
        raise ValueError("--output resolved outside the permitted build directory")
    if target.exists() and not target.is_dir():
        raise ValueError("--output must be a directory")
    return target


def safe_clean_output(target):
    """Remove only a previously validated build directory, never a computed source."""
    validate_output(str(target))
    if target.exists():
        # Refuse unexpected links in an old build instead of following them.
        for path in target.rglob("*"):
            if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
                raise ValueError("Refusing to clean a build directory containing links")
        shutil.rmtree(target)
    target.mkdir(parents=True)


def valid_date(value):
    try:
        if dt.date.fromisoformat(value).isoformat() != value:
            raise ValueError
    except (ValueError, TypeError) as error:
        raise ValueError("Expected a date in YYYY-MM-DD format") from error
    return value


def modified_date(source, fallback):
    try:
        relative = str(source.relative_to(ROOT))
        dirty = subprocess.run(
            ["git", "status", "--porcelain", "--untracked-files=normal", "--", relative],
            cwd=ROOT, text=True, capture_output=True, check=True,
        ).stdout.strip()
        if dirty:
            return fallback
        value = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", relative],
            cwd=ROOT, text=True, capture_output=True, check=True,
        ).stdout.strip()
        return valid_date(value) if value else fallback
    except (OSError, subprocess.SubprocessError, ValueError):
        return fallback


def validate_route(value):
    if not isinstance(value, str) or not value or "\\" in value or value.startswith("/"):
        raise ValueError("Content routes must be project-relative .html paths")
    parts = PurePosixPath(value).parts
    if any(part in {".", ".."} or part.startswith(".") for part in parts):
        raise ValueError("Invalid content route: " + value)
    if not value.endswith(".html") or value != PurePosixPath(value).as_posix():
        raise ValueError("Content routes must be normalized .html paths: " + value)
    if parts[0] in {"zh", "assets", "papers", "tools", "content"} or parts[0].startswith("_"):
        raise ValueError("Reserved content route: " + value)
    return value


def load_content():
    module_path = ROOT / "tools" / "search_pages.py"
    if not module_path.exists():
        return []
    spec = importlib.util.spec_from_file_location("cbsr_search_pages", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    pages = module.build_pages()
    if not isinstance(pages, list):
        raise ValueError("search_pages.build_pages() must return a list")
    for page in pages:
        if not isinstance(page, dict):
            raise ValueError("Every generated page must be a dict")
        validate_route(page.get("route"))
        for key in ("title", "description", "body"):
            if not isinstance(page.get(key), dict) or any(not isinstance(page[key].get(lang), str) or not page[key][lang].strip() for lang in ("en", "zh")):
                raise ValueError(page["route"] + " must have substantive en/zh " + key)
        valid_date(page.get("modified"))
        if page.get("kind") not in {"dataset", "jurisdiction", "corridor", "research", "guide", "index"}:
            raise ValueError("Unknown page kind for " + page["route"])
    return pages


def route_path(route, language="en"):
    suffix = route[:-len("index.html")] if route.endswith("/index.html") or route == "index.html" else route
    return ("zh/" if language == "zh" else "") + suffix


def page_url(base_url, route, language="en"):
    return base_url + route_path(route, language)


def local_route(path, base_url):
    base_path = urlsplit(base_url).path
    if not path.startswith(base_path):
        return None
    relative = path[len(base_path):]
    if relative.startswith("zh/"):
        relative = relative[len("zh/"):]
    if not relative or relative.endswith("/"):
        relative += "index.html"
    return relative


def rewrite_url(value, source_route, language, base_url, known_routes, translate_link=True):
    if not value or value.startswith(("#", "?", "mailto:", "tel:", "data:", "javascript:")):
        return value
    value = value.replace("__SITE_URL__", base_url).replace("{{BASE_URL}}", base_url.rstrip("/"))
    raw = urlsplit(value)
    # A root-relative source link is relative to the site, including project sites.
    if value.startswith("/") and not value.startswith("//"):
        base_path = urlsplit(base_url).path
        path = raw.path
        if base_path != "/" and not path.startswith(base_path):
            path = base_path + path.lstrip("/")
        resolved = urlsplit(urlunsplit((urlsplit(base_url).scheme, urlsplit(base_url).netloc, path, raw.query, raw.fragment)))
    else:
        resolved = urlsplit(urljoin(base_url + source_route, value))
    origin = urlsplit(base_url)
    if resolved.scheme != origin.scheme or resolved.netloc != origin.netloc:
        return value
    route = local_route(resolved.path, base_url)
    if translate_link and route in known_routes:
        path = urlsplit(page_url(base_url, route, language)).path
    else:
        path = resolved.path
    # Legacy language parameters now have a dedicated, canonical destination.
    query = urlencode([(key, val) for key, val in parse_qsl(resolved.query, keep_blank_values=True) if key != "lang"])
    return urlunsplit(("", "", path, query, resolved.fragment))


def set_meta(head, name, value, property_name=False):
    key = "property" if property_name else "name"
    matches = [node for node in head.children if node.tag == "meta" and node.attrs.get(key) == name]
    if matches:
        matches[0].attrs["content"] = value
        for duplicate in matches[1:]:
            head.children.remove(duplicate)
    else:
        head.children.append(Node("meta", {key: name, "content": value}))


def canonical_links(head, base_url, route, language, indexable):
    head.children = [node for node in head.children if not (
        node.tag == "link" and (node.attrs.get("rel") == "canonical" or node.attrs.get("hreflang"))
    )]
    head.children.append(Node("link", {"rel": "canonical", "href": page_url(base_url, route, language)}))
    if indexable:
        for hreflang, locale in (("en", "en"), ("zh-Hans", "zh"), ("x-default", "en")):
            head.children.append(Node("link", {"rel": "alternate", "hreflang": hreflang, "href": page_url(base_url, route, locale)}))


def structured_values(value, base_url):
    if isinstance(value, dict):
        return {key: structured_values(item, base_url) for key, item in value.items()}
    if isinstance(value, list):
        return [structured_values(item, base_url) for item in value]
    if isinstance(value, str):
        value = value.replace("__SITE_URL__", base_url).replace("{{BASE_URL}}", base_url.rstrip("/"))
        return base_url + value.lstrip("/") if value.startswith("/") else value
    return value


def make_breadcrumbs(base_url, route, language, title, lookup):
    home = "首页" if language == "zh" else "Home"
    items = [{"@type": "ListItem", "position": 1, "name": home, "item": page_url(base_url, "index.html", language)}]
    if route != "index.html":
        parts = PurePosixPath(route).parts
        for depth in range(1, len(parts)):
            parent = "/".join(parts[:depth]) + "/index.html"
            if parent == route or parent not in lookup:
                continue
            items.append({"@type": "ListItem", "position": len(items) + 1, "name": lookup[parent][language], "item": page_url(base_url, parent, language)})
        items.append({"@type": "ListItem", "position": len(items) + 1, "name": title, "item": page_url(base_url, route, language)})
    return items


def add_schema(head, base_url, route, language, title, description, modified, lookup, extra):
    canonical = page_url(base_url, route, language)
    locale = "zh-Hans" if language == "zh" else "en"
    graph = [
        {"@type": "Person", "@id": base_url + "#person", "name": "Yunjie Fan", "identifier": ORCID, "sameAs": [ORCID], "url": page_url(base_url, "about.html", language)},
        {"@type": "WebSite", "@id": base_url + "#website", "url": base_url, "name": "CBSR", "alternateName": ["cbsr.site"], "inLanguage": ["en", "zh-Hans"], "publisher": {"@id": base_url + "#person"}},
        {"@type": "WebPage", "@id": canonical + "#webpage", "url": canonical, "name": title, "description": description, "inLanguage": locale, "dateModified": modified, "isPartOf": {"@id": base_url + "#website"}, "author": {"@id": base_url + "#person"}, "breadcrumb": {"@id": canonical + "#breadcrumb"}},
        {"@type": "BreadcrumbList", "@id": canonical + "#breadcrumb", "itemListElement": make_breadcrumbs(base_url, route, language, title, lookup)},
    ]
    if extra:
        if isinstance(extra, dict) and "en" in extra and "zh" in extra:
            extra = extra[language]
        additions = extra if isinstance(extra, list) else [extra]
        for item in additions:
            if not isinstance(item, dict):
                raise ValueError("structured_data must contain JSON-LD objects")
            item = structured_values(copy.deepcopy(item), base_url)
            item.pop("@context", None)
            if item.get("@type") in {"Dataset", "ScholarlyArticle", "Article", "TechArticle"}:
                item.setdefault("@id", canonical + "#" + item["@type"].lower())
                graph[2].setdefault("mainEntity", {"@id": item["@id"]})
            graph.append(item)
    head.children = [node for node in head.children if not (node.tag == "script" and node.attrs.get("type") == "application/ld+json")]
    # Escape '<' so a paper title can never close the HTML script element.
    encoded = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    head.children.append(Node("script", {"type": "application/ld+json"}, [Node(raw=encoded)]))
    # Keep the existing strict policy and permit only this exact data block.
    # Never enable arbitrary inline JavaScript merely to publish JSON-LD.
    digest = base64.b64encode(hashlib.sha256(encoded.encode("utf-8")).digest()).decode("ascii")
    for node in head.children:
        if node.tag == "meta" and node.attrs.get("http-equiv", "").lower() == "content-security-policy":
            directives = [part.strip() for part in node.attrs.get("content", "").split(";") if part.strip()]
            node.attrs["content"] = "; ".join(part + " 'sha256-" + digest + "'" if part.startswith("script-src ") else part for part in directives)


def build_page(page, language, base_url, known_routes, lookup):
    tree = copy.deepcopy(page["tree"])
    root = tree.first("html")
    head = tree.first("head")
    if root is None or head is None:
        raise ValueError(page["route"] + " must have html/head elements")
    source_title = root.attrs.get("data-title-zh" if language == "zh" else "data-title-en")
    translate(tree, language)
    root.attrs.update({"lang": "zh-Hans" if language == "zh" else "en", "data-static-locale": language, "data-source-route": page["route"], "data-snapshot-version": "0.11.0", "data-snapshot-date": "2026-08-20"})
    title = page.get("title", {}).get(language) or source_title or node_text(head.first("title"))
    title_node = head.first("title")
    if title_node is None:
        title_node = Node("title")
        head.children.append(title_node)
    title_node.children = [text_node(title)]
    description_node = next((node for node in head.walk() if node.tag == "meta" and node.attrs.get("name") == "description"), None)
    description = page.get("description", {}).get(language) or (description_node.attrs.get("content", "") if description_node else "")
    if not description:
        raise ValueError(page["route"] + " has no description")
    for name, value, prop in (
        ("description", description, False), ("og:title", title, True), ("og:description", description, True),
        ("og:url", page_url(base_url, page["route"], language), True),
        ("og:locale", "zh_CN" if language == "zh" else "en_US", True),
        ("og:locale:alternate", "en_US" if language == "zh" else "zh_CN", True),
        ("twitter:title", title, False), ("twitter:description", description, False),
    ):
        set_meta(head, name, value, prop)
    for node in tree.walk():
        for attribute in ("href", "src", "poster", "action"):
            if attribute in node.attrs:
                # Canonical and hreflang links are inserted after the route transform.
                node.attrs[attribute] = rewrite_url(node.attrs[attribute], page["route"], language, base_url, known_routes, attribute == "href")
        for attribute, value in list(node.attrs.items()):
            if isinstance(value, str):
                node.attrs[attribute] = value.replace("__SITE_URL__", base_url)
        if node.tag == "input" and node.attrs.get("name") == "_next":
            node.attrs["value"] = page_url(base_url, "thanks.html", "en")
    # Always replace the source toggle with ordinary, crawlable links.
    toggles = [node for node in tree.walk() if node.attrs.get("id") == "langtog"]
    for toggle in toggles:
        toggle.attrs["aria-label"] = "语言" if language == "zh" else "Language"
        toggle.children = []
        for code, label in (("en", "EN"), ("zh", "中文")):
            attrs = {"href": urlsplit(page_url(base_url, page["route"], code)).path, "data-lang": code, "hreflang": "zh-Hans" if code == "zh" else "en", "lang": "zh-Hans" if code == "zh" else "en"}
            if code == language:
                attrs.update({"class": "on", "aria-current": "page"})
            toggle.children.extend([Node("a", attrs, [text_node(label)]), Node(raw=" ")])
    canonical_links(head, base_url, page["route"], language, page["indexable"])
    if page["indexable"]:
        add_schema(head, base_url, page["route"], language, title, description, page["modified"], lookup, page.get("structured_data"))
    else:
        set_meta(head, "robots", "noindex, follow")
    if language == "zh":
        for node in tree.walk():
            if node.tag == "a" and "skip" in node.attrs.get("class", "").split():
                node.children = [text_node("跳至正文")]
    return tree.render(), title, description


def new_page_tree(template, body, language):
    tree = copy.deepcopy(template)
    # The shared shell originates at the repository root. Keep its resources
    # rooted there when the new article lives at e.g. /data/hong-kong.html.
    # Article body links are then inserted independently as site-root URLs.
    for node in tree.walk():
        for attribute in ("href", "src", "poster", "action"):
            value = node.attrs.get(attribute)
            if not value or value.startswith(("/", "#", "?", "__SITE_URL__")):
                continue
            parts = urlsplit(value)
            if not parts.scheme and not parts.netloc:
                node.attrs[attribute] = "/" + value
    original = tree.first("main")
    if original is None:
        raise ValueError("index.html has no main shell")
    fragment = parse_html(body)
    main = fragment.first("main")
    if main is None:
        main = Node("main", {"id": "main", "class": "wrap search-page"}, fragment.children)
    else:
        main.attrs.setdefault("id", "main")
    replace_node(tree, original, [main])
    body_node = tree.first("body")
    if body_node:
        body_node.attrs["class"] = "search-detail"
    return tree


def copy_static(output):
    published = []
    for name in STATIC_FILES:
        source = ROOT / name
        if not source.is_file() or source.is_symlink():
            raise ValueError("Required static file missing or linked: " + name)
        shutil.copyfile(source, output / name)
        published.append(name)
    for directory in STATIC_DIRECTORIES:
        source_dir = ROOT / directory
        if not source_dir.is_dir() or source_dir.is_symlink() or (hasattr(source_dir, "is_junction") and source_dir.is_junction()):
            raise ValueError("Required static directory missing or linked: " + directory)
        for source in sorted(source_dir.rglob("*")):
            relative = source.relative_to(ROOT)
            if source.is_symlink() or (hasattr(source, "is_junction") and source.is_junction()):
                raise ValueError("Static asset trees cannot contain links")
            if source.is_file() and not any(part.startswith(".") for part in relative.parts):
                target = output / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
                published.append(relative.as_posix())
    return published


def copy_evidence_downloads(output):
    """Publish selected immutable evidence, without publishing source content."""
    source_dir = ROOT / "content" / "search"
    if not source_dir.exists():
        return []
    if source_dir.is_symlink() or (hasattr(source_dir, "is_junction") and source_dir.is_junction()):
        raise ValueError("Evidence source directory cannot be linked")
    manifest_path = source_dir / "snapshot-manifest.json"
    if not manifest_path.is_file():
        raise ValueError("Evidence sources need a snapshot-manifest.json before publication")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("files")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Evidence manifest must explicitly list its public files")
    candidates = [manifest_path]
    seen = set()
    for entry in entries:
        relative = entry.get("local_path", "")
        path = PurePosixPath(relative)
        if (not relative.startswith("snapshots/") or "\\" in relative or
                relative != path.as_posix() or any(part in {".", ".."} or part.startswith(".") for part in path.parts)):
            raise ValueError("Invalid evidence manifest path")
        if relative in seen:
            raise ValueError("Duplicate evidence manifest path")
        seen.add(relative)
        source = source_dir
        for part in path.parts:
            source = source / part
            if source.is_symlink() or (hasattr(source, "is_junction") and source.is_junction()):
                raise ValueError("Evidence paths cannot contain links")
        if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != entry.get("sha256"):
            raise ValueError("Missing or changed public evidence: " + relative)
        candidates.append(source)
    published = []
    for source in candidates:
        if source.is_symlink() or (hasattr(source, "is_junction") and source.is_junction()):
            raise ValueError("Evidence downloads cannot contain links")
        if not source.is_file():
            continue
        relative = source.relative_to(source_dir)
        if (source.suffix not in {".json", ".md", ".cff"} and source.name != "LICENSE-DATA") or any(part.startswith(".") for part in relative.parts):
            raise ValueError("Unexpected evidence download: " + relative.as_posix())
        target_relative = Path("assets") / "search" / relative
        target = output / target_relative
        target.parent.mkdir(parents=True, exist_ok=True)
        # Bytes are kept intact so the public manifest hashes still verify.
        shutil.copyfile(source, target)
        published.append(target_relative.as_posix())
    return published


def write_sitemap(output, base_url, manifest):
    ET.register_namespace("", SITEMAP_NS)
    ET.register_namespace("xhtml", XHTML_NS)
    root = ET.Element("{" + SITEMAP_NS + "}urlset")
    for page in manifest:
        if not page["indexable"]:
            continue
        item = ET.SubElement(root, "{" + SITEMAP_NS + "}url")
        ET.SubElement(item, "{" + SITEMAP_NS + "}loc").text = page["canonical"]
        ET.SubElement(item, "{" + SITEMAP_NS + "}lastmod").text = page["last_modified"]
        for lang, code in (("en", "en"), ("zh-Hans", "zh"), ("x-default", "en")):
            ET.SubElement(item, "{" + XHTML_NS + "}link", {"rel": "alternate", "hreflang": lang, "href": page_url(base_url, page["source_route"], code)})
    ET.indent(root, space="  ")
    ET.ElementTree(root).write(output / "sitemap.xml", encoding="utf-8", xml_declaration=True)


def write_discovery(output, base_url, manifest):
    # No crawler-specific block: search bots can read the same public evidence.
    path = urlsplit(base_url).path
    robots = "# CBSR public evidence: data CC-BY-4.0; code Apache-2.0.\nUser-agent: *\nAllow: " + path + "\n\nSitemap: " + base_url + "sitemap.xml\n"
    (output / "robots.txt").write_text(robots, encoding="utf-8")
    lines = ["# CBSR", "", "> Evidence infrastructure for agentic finance. Its current published dataset is the Cross-Border Stablecoin Register.", "", "CBSR is maintained by Yunjie Fan (" + ORCID + "). Public records are dated research evidence, not legal advice or authority to execute transactions.", "", "The pinned register snapshot is v0.11.0, dated 2026-08-20: 152 sourced records, 46 structural candidates, and 0 decision-ready records. A structural candidate does not establish current applicable law.", "", "## Source and citation", "", "- [Source register](" + REGISTER_URL + ")", "- [Dataset concept DOI](https://doi.org/10.5281/zenodo.20730358)", "- [Sitemap](" + base_url + "sitemap.xml)", "", "## English pages", ""]
    for language, heading in (("en", None), ("zh", "## 中文页面")):
        if heading:
            lines.extend(["", heading, ""])
        for page in manifest:
            if page["indexable"] and page["language"] == language:
                lines.append("- [" + page["title"].replace("[", "(").replace("]", ")") + "](" + page["canonical"] + "): " + page["description"])
    lines.extend(["", "Cite the page URL, dataset version, source provision, evidence date, and stated uncertainty. Review underlying primary law before relying on a record. This file is a discovery aid; it grants no additional authority or endorsement.", ""])
    (output / "llms.txt").write_text("\n".join(lines), encoding="utf-8")


def build(base_url, output, fallback_date):
    root_pages = []
    for source in sorted(ROOT.glob("*.html")):
        if source.is_symlink():
            raise ValueError("Root HTML cannot be a symbolic link")
        tree = parse_html(source.read_text(encoding="utf-8"))
        noindex = any(node.tag == "meta" and node.attrs.get("name") == "robots" and "noindex" in node.attrs.get("content", "").lower() for node in tree.walk())
        root_pages.append({"route": source.name, "tree": tree, "modified": modified_date(source, fallback_date), "indexable": not noindex, "source": "root-html"})
    if not any(page["route"] == "index.html" for page in root_pages):
        raise ValueError("index.html is required")
    generated = load_content()
    known_routes = {page["route"] for page in root_pages}
    for page in generated:
        if page["route"] in known_routes:
            raise ValueError("Duplicate content route: " + page["route"])
        known_routes.add(page["route"])
    template = next(page["tree"] for page in root_pages if page["route"] == "index.html")
    pages = list(root_pages)
    for generated_page in generated:
        page = dict(generated_page)
        page.update({"indexable": True, "source": "search-content"})
        pages.append(page)
    lookup = {}
    for page in pages:
        if page.get("title"):
            lookup[page["route"]] = page["title"]
        else:
            root = page["tree"].first("html")
            title = node_text(page["tree"].first("title"))
            lookup[page["route"]] = {"en": root.attrs.get("data-title-en", title), "zh": root.attrs.get("data-title-zh", title)}
    # Render all HTML and validate it before cleaning the previous publication.
    documents, manifest = [], []
    for page in pages:
        for language in ("en", "zh"):
            variant = dict(page)
            if page["source"] == "search-content":
                variant["tree"] = new_page_tree(template, page["body"][language], language)
            rendered, title, description = build_page(variant, language, base_url, known_routes, lookup)
            if "__SITE_URL__" in rendered or "{{BASE_URL}}" in rendered:
                raise ValueError("Unresolved URL placeholder in " + page["route"])
            relative = ("zh/" if language == "zh" else "") + page["route"]
            documents.append((relative, rendered))
            manifest.append({"route": relative, "source_route": page["route"], "language": language, "canonical": page_url(base_url, page["route"], language), "last_modified": page["modified"], "indexable": page["indexable"], "title": title, "description": description, "source": page["source"]})
    safe_clean_output(output)
    published = copy_static(output)
    published.extend(copy_evidence_downloads(output))
    for relative, rendered in documents:
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rendered, encoding="utf-8", newline="\n")
    write_sitemap(output, base_url, manifest)
    write_discovery(output, base_url, manifest)
    checksums = {relative: hashlib.sha256((output / relative).read_bytes()).hexdigest() for relative in sorted(published)}
    data = {"schema_version": 1, "base_url": base_url, "pages": manifest, "snapshot": {"version": "0.11.0", "as_of": "2026-08-20", "source_commit": SNAPSHOT_COMMIT, "source_repository": REGISTER_URL}, "static_files_sha256": checksums}
    (output / "build-manifest.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Built " + str(len(manifest)) + " HTML pages (" + str(sum(page["indexable"] for page in manifest)) + " indexable), reciprocal language links, sitemap, robots.txt and llms.txt.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="https://cbsr.site/")
    parser.add_argument("--output", default="_site")
    parser.add_argument("--modified-date", help="Date for changed/untracked source pages (default: today's date in Asia/Singapore)")
    args = parser.parse_args(argv)
    try:
        base_url = normalize_base_url(args.base_url)
        output = validate_output(args.output)
        today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat()
        fallback_date = valid_date(args.modified_date) if args.modified_date else today
        build(base_url, output, fallback_date)
    except (ValueError, OSError, ImportError) as error:
        parser.exit(2, "Build error: " + str(error) + "\n")


if __name__ == "__main__":
    main()
