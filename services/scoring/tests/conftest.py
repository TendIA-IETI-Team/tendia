import random

import pytest

from tendia_scoring.synthetic import generate_business


@pytest.fixture
def good_request():
    rng = random.Random(3)
    for _ in range(200):
        b = generate_business(rng, "2026-09")
        if b.quality > 1.2:
            return b.request
    raise AssertionError("no se generó un negocio bueno")


@pytest.fixture
def risky_request():
    rng = random.Random(4)
    for _ in range(200):
        b = generate_business(rng, "2026-09")
        if b.quality < -1.2:
            return b.request
    raise AssertionError("no se generó un negocio riesgoso")
