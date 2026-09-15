import pytest
from django.db import DatabaseError
from django.urls import reverse

from apps.core import views


@pytest.mark.django_db
def test_health_reports_database_is_available(client):
    response = client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


@pytest.mark.django_db
def test_health_hides_database_error(client, monkeypatch):
    def unavailable_cursor():
        raise DatabaseError("connection contains private details")

    monkeypatch.setattr(views.connection, "cursor", unavailable_cursor)

    response = client.get(reverse("health"))

    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "database": "unavailable",
    }
    assert b"private details" not in response.content
