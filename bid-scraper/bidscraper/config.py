from __future__ import annotations

import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path


def app_dir() -> Path:
    """Pasta do programa (funciona também empacotado com PyInstaller)."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


@dataclass
class Config:
    base: Path = field(default_factory=app_dir)
    geral: dict = field(default_factory=dict)
    http: dict = field(default_factory=dict)
    site: dict = field(default_factory=dict)

    def path(self, key: str) -> Path:
        p = Path(self.geral[key])
        return p if p.is_absolute() else self.base / p


DEFAULTS = {
    "geral": {
        "db_path": "data/bid.sqlite",
        "log_path": "data/bid.log",
        "exports_dir": "exports",
        "dias_historico": 730,
        "janela_diaria": 3,
        "historico_max_idade_dias": 30,
    },
    "http": {
        "user_agent": "BIDScraper/1.0 (pesquisa)",
        "atraso_segundos": 2.0,
        "timeout": 30,
        "tentativas": 5,
        "respeitar_robots": True,
        "salvar_bruto": True,
        "modo": "requests",
    },
    "site": {
        "base_url": "https://bid.cbf.com.br/",
        "url_dia": "https://bid.cbf.com.br/?data={data}&pagina={pagina}",
        "url_atleta": "https://bid.cbf.com.br/atleta/{id}",
        "formato_data_url": "%d/%m/%Y",
        "regex_id_atleta": r"(?:atleta|atletas|id)[=/](\d+)",
        "max_paginas": 200,
        "marcador_sem_resultados": "nenhum registro",
    },
}


def load_config(path: str | Path | None = None) -> Config:
    base = app_dir()
    cfg_path = Path(path) if path else base / "config.toml"
    data: dict = {}
    if cfg_path.exists():
        with open(cfg_path, "rb") as f:
            data = tomllib.load(f)
    merged = {k: {**v, **data.get(k, {})} for k, v in DEFAULTS.items()}
    return Config(base=base, **merged)
