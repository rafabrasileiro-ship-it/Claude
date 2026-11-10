from __future__ import annotations

import gzip
import hashlib
import logging
import random
import time
from datetime import datetime
from pathlib import Path
from urllib import robotparser
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .config import Config

log = logging.getLogger("bid.http")


class Fetcher:
    """Cliente HTTP educado: pausa entre requisições, retentativas, robots.txt e cache bruto."""

    def __init__(self, cfg: Config):
        self.cfg = cfg
        h = cfg.http
        self.delay = float(h["atraso_segundos"])
        self.timeout = int(h["timeout"])
        self.mode = h["modo"]
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": h["user_agent"],
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9",
        })
        retry = Retry(total=int(h["tentativas"]), backoff_factor=2,
                      status_forcelist=(429, 500, 502, 503, 504),
                      allowed_methods=("GET",), respect_retry_after_header=True)
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
        self.session.mount("http://", HTTPAdapter(max_retries=retry))
        self._last = 0.0
        self._robots: dict[str, robotparser.RobotFileParser | None] = {}
        self._pw = self._browser = self._page = None
        self.raw_dir = cfg.base / "data" / "raw"

    # -- robots.txt ---------------------------------------------------------
    def _allowed(self, url: str) -> bool:
        if not self.cfg.http["respeitar_robots"]:
            return True
        p = urlparse(url)
        root = f"{p.scheme}://{p.netloc}"
        if root not in self._robots:
            rp = robotparser.RobotFileParser()
            try:
                r = self.session.get(root + "/robots.txt", timeout=self.timeout)
                if r.status_code == 200:
                    rp.parse(r.text.splitlines())
                    self._robots[root] = rp
                else:
                    self._robots[root] = None  # sem robots => liberado
            except requests.RequestException:
                self._robots[root] = None
        rp = self._robots[root]
        return True if rp is None else rp.can_fetch(self.cfg.http["user_agent"], url)

    def _sleep(self) -> None:
        wait = self.delay + random.uniform(0, self.delay * 0.3) - (time.time() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.time()

    # -- API ----------------------------------------------------------------
    def get(self, url: str) -> str:
        if not self._allowed(url):
            raise PermissionError(f"robots.txt do site proíbe a coleta de {url}")
        self._sleep()
        log.debug("GET %s", url)
        body = self._get_browser(url) if self.mode == "browser" else self._get_requests(url)
        self._save_raw(url, body)
        return body

    def _get_requests(self, url: str) -> str:
        r = self.session.get(url, timeout=self.timeout)
        r.raise_for_status()
        if not r.encoding or r.encoding.lower() == "iso-8859-1":
            r.encoding = r.apparent_encoding or "utf-8"
        return r.text

    def _get_browser(self, url: str) -> str:
        if self._page is None:
            try:
                from playwright.sync_api import sync_playwright
            except ImportError as e:  # pragma: no cover
                raise RuntimeError(
                    "Modo 'browser' requer: pip install playwright && playwright install chromium"
                ) from e
            self._pw = sync_playwright().start()
            self._browser = self._pw.chromium.launch(headless=True)
            ctx = self._browser.new_context(user_agent=self.cfg.http["user_agent"], locale="pt-BR")
            self._page = ctx.new_page()
        self._page.goto(url, timeout=self.timeout * 1000, wait_until="networkidle")
        return self._page.content()

    def _save_raw(self, url: str, body: str) -> None:
        if not self.cfg.http["salvar_bruto"]:
            return
        day = datetime.now().strftime("%Y%m%d")
        d = self.raw_dir / day
        d.mkdir(parents=True, exist_ok=True)
        name = hashlib.sha1(url.encode()).hexdigest()[:16]
        with gzip.open(d / f"{name}.html.gz", "wt", encoding="utf-8") as f:
            f.write(f"<!-- {url} -->\n{body}")

    def close(self) -> None:
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()
