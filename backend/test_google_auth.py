"""Google (Gmail) sign-in: signed state, account creation/linking, one-time ticket."""
from urllib.parse import parse_qs, quote, urlparse

import pytest

# Import the shared test host first: it prepares DATABASE_URL/JWT_SECRET before main loads.
from backend.test_backend import _host, ORIGIN

import backend.main as main

TAB = {"X-Session-Mode": "tab", **ORIGIN}


@pytest.fixture(autouse=True)
def clean_google():
    main.limits.clear()
    with main.google_tickets_lock:
        main.google_tickets.clear()


def enable(monkeypatch, profile=None):
    monkeypatch.setattr(main, "GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    monkeypatch.setattr(main, "GOOGLE_CLIENT_SECRET", "test-secret")
    monkeypatch.setattr(
        main,
        "GOOGLE_REDIRECT_URI",
        "http://localhost:3000/api/auth/google/callback",
    )
    monkeypatch.setattr(
        main,
        "exchange_google_code",
        lambda code, uri: {"access_token": "access-" + code},
    )
    monkeypatch.setattr(
        main,
        "google_profile",
        lambda token: profile
        or {
            "sub": "google-sub-default",
            "email": "gmail.default@example.com",
            "email_verified": True,
        },
    )


def complete_login(monkeypatch, profile, next_path="/"):
    """Run start -> callback and return the redirect query parameters."""
    enable(monkeypatch, profile)
    start = _host.get(
        "/api/auth/google/start?next=" + quote(next_path), follow_redirects=False
    )
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    callback = _host.get(
        "/api/auth/google/callback?code=test-code&state=" + quote(state),
        follow_redirects=False,
    )
    return parse_qs(urlparse(callback.headers["location"]).query)


def test_google_start_reports_missing_configuration(monkeypatch):
    monkeypatch.setattr(main, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(main, "GOOGLE_CLIENT_SECRET", "")
    response = _host.get("/api/auth/google/start", follow_redirects=False)
    assert response.status_code == 302
    assert "google_error=unconfigured" in response.headers["location"]


def test_google_sign_in_creates_account_and_uses_one_time_ticket(monkeypatch):
    profile = {
        "sub": "google-sub-flow",
        "email": "flow.player@gmail.com",
        "email_verified": True,
    }
    params = complete_login(monkeypatch, profile, "/ghep-tran")
    assert params["next"] == ["/ghep-tran"]
    ticket = params["google_ticket"][0]

    exchange = _host.post(
        "/api/auth/google/exchange", json={"ticket": ticket}, headers=TAB
    )
    assert exchange.status_code == 200, exchange.text
    data = exchange.json()
    assert data["username"] == "flowplayer"
    assert data["access_token"]

    me = _host.get(
        "/api/auth/me",
        headers={**TAB, "Authorization": "Bearer " + data["access_token"]},
    )
    assert me.json()["id"] == data["id"]

    with main.SessionLocal() as s:
        u = s.get(main.User, data["id"])
        assert u.email == "flow.player@gmail.com"
        assert u.google_sub == "google-sub-flow"

    # A ticket is single use; a leaked redirect link cannot sign in twice.
    replay = _host.post(
        "/api/auth/google/exchange", json={"ticket": ticket}, headers=TAB
    )
    assert replay.status_code == 401

    # Signing in again reuses the same account.
    again = complete_login(monkeypatch, profile)
    second = _host.post(
        "/api/auth/google/exchange",
        json={"ticket": again["google_ticket"][0]},
        headers=TAB,
    )
    assert second.status_code == 200
    assert second.json()["id"] == data["id"]


def test_google_start_rejects_external_redirect(monkeypatch):
    params = complete_login(
        monkeypatch,
        {
            "sub": "google-sub-redirect",
            "email": "redirect.player@gmail.com",
            "email_verified": True,
        },
        "//evil.example/steal",
    )
    assert params["next"] == ["/"]


def test_google_callback_rejects_forged_state(monkeypatch):
    enable(monkeypatch)
    response = _host.get(
        "/api/auth/google/callback?code=abc&state=forged", follow_redirects=False
    )
    assert response.status_code == 302
    assert "google_error=state" in response.headers["location"]


def test_google_rejects_unverified_email(monkeypatch):
    params = complete_login(
        monkeypatch,
        {
            "sub": "google-sub-unverified",
            "email": "unverified@gmail.com",
            "email_verified": False,
        },
    )
    assert params["google_error"] == ["account"]
    assert "google_ticket" not in params


def test_google_username_avoids_existing_player(monkeypatch):
    _host.post(
        "/api/auth/register",
        json={"username": "gcollide", "password": "test-password-0123"},
        headers=ORIGIN,
    )
    params = complete_login(
        monkeypatch,
        {
            "sub": "google-sub-collision",
            "email": "gcollide@gmail.com",
            "email_verified": True,
        },
    )
    exchange = _host.post(
        "/api/auth/google/exchange",
        json={"ticket": params["google_ticket"][0]},
        headers=TAB,
    )
    assert exchange.status_code == 200
    assert exchange.json()["username"] == "gcollide2"


def test_google_links_row_with_same_verified_email(monkeypatch):
    with main.SessionLocal() as s:
        u = main.User(
            username="linked_player",
            password=main.digest("test-password-0123"),
            email="linked.player@gmail.com",
        )
        s.add(u)
        s.commit()
        uid = u.id
    params = complete_login(
        monkeypatch,
        {
            "sub": "google-sub-linked",
            "email": "linked.player@gmail.com",
            "email_verified": True,
        },
    )
    exchange = _host.post(
        "/api/auth/google/exchange",
        json={"ticket": params["google_ticket"][0]},
        headers=TAB,
    )
    assert exchange.status_code == 200
    assert exchange.json()["id"] == uid
    with main.SessionLocal() as s:
        assert s.get(main.User, uid).google_sub == "google-sub-linked"
