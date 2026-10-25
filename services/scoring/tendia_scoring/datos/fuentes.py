"""Descarga y caché de las fuentes de datos abiertas.

Todas son públicas y de uso libre con atribución:

- UCI #350 "Default of Credit Card Clients" (Yeh, 2009), CC BY 4.0.
  30.000 créditos reales con 6 meses de historial de pagos y si incumplieron el mes siguiente.
- DANE, Encuesta de Micronegocios (EMICRON) 2024, publicada en datos.gov.co (7fku-rfe7).
- Superintendencia Financiera, "Tasas de interés activas por tipo de crédito – Histórico",
  datos.gov.co (w9zh-vetq).

Los archivos crudos se guardan en services/scoring/.cache (ignorado por git). Lo que se versiona
en el repo son solo los agregados derivados (tendia_scoring/model/referencias/*.json).
"""

from __future__ import annotations

import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parents[2] / ".cache"
USER_AGENT = "TendIA-scoring/0.2 (proyecto academico ECI; contacto en el repo)"

UCI_CREDIT_DEFAULT = (
    "https://archive.ics.uci.edu/static/public/350/default+of+credit+card+clients.zip"
)

EMICRON_2024 = {
    "ventas": "https://microdatos.dane.gov.co/index.php/catalog/875/download/24195",
    "identificacion": "https://microdatos.dane.gov.co/index.php/catalog/875/download/24189",
    "caracteristicas": "https://microdatos.dane.gov.co/index.php/catalog/875/download/24186",
    "inclusion": "https://microdatos.dane.gov.co/index.php/catalog/875/download/24190",
}

SFC_TASAS = "https://www.datos.gov.co/resource/w9zh-vetq.json"


def _get(url: str) -> bytes:
    if not url.startswith("https://"):
        raise ValueError("Solo se descargan fuentes por https")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    with urllib.request.urlopen(req, timeout=300) as resp:  # noqa: S310
        return resp.read()


def descargar(url: str, nombre: str) -> Path:
    """Descarga una vez y reutiliza la copia local."""
    CACHE.mkdir(parents=True, exist_ok=True)
    destino = CACHE / nombre
    if not destino.exists():
        destino.write_bytes(_get(url))
    return destino


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def consultar_socrata(url: str, params: dict[str, str], nombre: str) -> list[dict]:
    """Consulta SODA (datos.gov.co) y guarda la respuesta en caché."""
    CACHE.mkdir(parents=True, exist_ok=True)
    destino = CACHE / nombre
    if not destino.exists():
        destino.write_bytes(_get(f"{url}?{urllib.parse.urlencode(params)}"))
    return json.loads(destino.read_text(encoding="utf-8"))
