from app import emails


class FakeSes:
    def __init__(self, fail: bool = False):
        self.sent: list[dict] = []
        self.fail = fail

    def send_email(self, **kwargs: object) -> None:
        if self.fail:
            raise RuntimeError("SES is down")
        self.sent.append(kwargs)


def test_ses_request_shape(monkeypatch, settings):
    fake = FakeSes()
    monkeypatch.setattr(emails, "_ses_client", lambda region: fake)
    settings.email_backend = "ses"
    message = emails.invitation("b@kiet.edu", "Code <Crafters>", "IT26-0001", "Aarav Sharma", settings)
    emails.send(message, settings)

    sent = fake.sent[0]
    assert sent["Destination"] == {"ToAddresses": ["b@kiet.edu"]}
    assert sent["FromEmailAddress"] == settings.email_sender
    assert sent["ReplyToAddresses"] == ["innotech@kiet.edu"]
    body = sent["Content"]["Simple"]["Body"]
    assert "Code <Crafters>" in body["Text"]["Data"]
    assert "Write to innotech@kiet.edu" in body["Text"]["Data"]
    # Student-typed text is escaped in the HTML part.
    assert "Code &lt;Crafters&gt;" in body["Html"]["Data"]


def test_email_failure_is_logged_not_raised(monkeypatch, settings, caplog):
    monkeypatch.setattr(emails, "_ses_client", lambda region: FakeSes(fail=True))
    settings.email_backend = "ses"
    emails.send(emails.team_submitted("a@kiet.edu", "Team", "IT26-0001", settings), settings)
    assert "Could not send email" in caplog.text


def test_invite_still_succeeds_when_email_fails(monkeypatch, settings, student, team_of):
    monkeypatch.setattr(emails, "_ses_client", lambda region: FakeSes(fail=True))
    settings.email_backend = "ses"
    leader, invitee = student("a@kiet.edu"), student("b@kiet.edu")
    team = team_of(leader)
    assert leader.post(f"/teams/{team['id']}/invitations", {"email": invitee.email}).status_code == 201
    assert len(invitee.get("/me/invitations").json()) == 1
