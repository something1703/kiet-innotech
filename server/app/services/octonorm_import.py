"""
Importing the organisers' octonorm list (the Excel sheet "LIST OF OCTONORMS STALL") on the Grand Finale page.

Nothing is saved here. The sheet is read and every stall is matched to a Grand Finale team, so the super admin sees what
would change and chooses where the match is not certain; the page then saves the chosen octonorms through
finale.save_entries, which refuses an octonorm given twice.

- Department winners are listed with their team code ("Code Warriors (IT26-0217)"), so they match exactly.
- Centres of Excellence, technical clubs, schools, other colleges and start-ups are listed by name only: each is matched
  to the Grand Finale team of that kind whose name, project or institution shares the most words with it. A row whose
  best match is not clear is left for the super admin to choose.

The file is read with the standard library (an .xlsx is a zip of XML parts), so no spreadsheet package is needed.
"""

import io
import re
import uuid
import zipfile
from xml.etree import ElementTree

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import rules
from ..errors import ApiError
from ..models import Admin, FinalTent, Team
from ..schemas import OctonormCandidateOut, OctonormImportOut, OctonormImportRowOut
from . import admin as admin_service
from . import judging, sections

MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
MAX_PART = 20 * 1024 * 1024
BAD_FILE = "This is not an Excel (.xlsx) file the panel can read. Save it as .xlsx and try again."
# Section headings of the organisers' sheet, and the Grand Finale section each one is.
HEADINGS = {
    "centres of excellence": "coe",
    "technical clubs": "club",
    "innovation at school": "school",
    "innovation at other colleges": "college",
    "innovation at start-ups": "startup",
    "udeshyaa club": None,
    "reserve / spare": None,
}
KIND = {"coe": "kiet", "club": "kiet", "school": "school", "college": "college", "startup": "startup"}
# Words too common to tell two teams apart.
COMMON = {
    "the", "team", "kiet", "and", "club", "coe", "pvt", "ltd", "private", "limited", "school", "public", "college", "university",
    "institute", "technology", "group", "colleges", "centre", "excellence", "ghaziabad", "noida", "delhi", "for", "lab", "llp",
    "sr", "sec", "of", "innovation", "society",
}  # fmt: skip


def _column(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref or "A")
    number = 0
    for c in letters.group(0) if letters else "A":
        number = number * 26 + ord(c) - 64
    return number - 1


def _xml(book: zipfile.ZipFile, name: str) -> ElementTree.Element:
    """One XML part of the workbook. Excel never writes a DOCTYPE, so a part with one is refused: no entities to expand."""
    data = book.read(name)
    if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ApiError(BAD_FILE, 422)
    return ElementTree.fromstring(data)  # noqa: S314 (no DOCTYPE, so no entity expansion; super admins only)


def read_rows(data: bytes) -> list[list[str]]:
    """The cells of the sheet named "List" (or the first sheet), row by row, as text."""
    try:
        book = zipfile.ZipFile(io.BytesIO(data))
        if any(info.file_size > MAX_PART for info in book.infolist()):
            raise ApiError(BAD_FILE, 422)
        names = set(book.namelist())
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            for item in _xml(book, "xl/sharedStrings.xml").iter(f"{MAIN}si"):
                shared.append("".join(t.text or "" for t in item.iter(f"{MAIN}t")))
        workbook = _xml(book, "xl/workbook.xml")
        targets = {r.get("Id"): r.get("Target", "") for r in _xml(book, "xl/_rels/workbook.xml.rels") if r.get("Id")}
        sheets = [(s.get("name", ""), targets.get(s.get(f"{REL}id"), "")) for s in workbook.iter(f"{MAIN}sheet")]
        if not sheets:
            raise ApiError(BAD_FILE, 422)
        _, target = next((s for s in sheets if s[0].strip().lower() == "list"), sheets[0])
        path = target.lstrip("/") if target.startswith("/") else f"xl/{target}"
        rows: list[list[str]] = []
        for row in _xml(book, path).iter(f"{MAIN}row"):
            cells: dict[int, str] = {}
            for cell in row.iter(f"{MAIN}c"):
                kind, value = cell.get("t"), cell.find(f"{MAIN}v")
                if kind == "s" and value is not None and value.text is not None:
                    text = shared[int(value.text)]
                elif kind == "inlineStr":
                    text = "".join(t.text or "" for t in cell.iter(f"{MAIN}t"))
                else:
                    text = value.text if value is not None and value.text is not None else ""
                cells[_column(cell.get("r", ""))] = " ".join(text.split())
            if any(cells.values()):
                rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
        return rows
    except (zipfile.BadZipFile, KeyError, ElementTree.ParseError, ValueError, IndexError) as exc:
        raise ApiError(BAD_FILE, 422) from exc


def parse_sheet(rows: list[list[str]]) -> list[dict]:
    """The stalls of the sheet: number, section, category (department winners), team code if given, and the label."""
    out: list[dict] = []
    section: str | None = None
    category: int | None = None
    for row in rows:
        values = [v for v in row if v]
        text = " ".join(values)
        if m := re.match(r"Category (\d):", text):
            section, category = "category", int(m.group(1))
            continue
        if text.lower() in HEADINGS:
            section, category = HEADINGS[text.lower()], None
            continue
        if section and len(values) >= 3 and values[0].isdigit():
            label = values[2]
            code = re.search(r"\((IT26-\d{4})\)\s*$", label)
            out.append(
                {
                    "octonorm": values[0],
                    "section": section,
                    "category": category,
                    "label": label,
                    "code": code.group(1) if code else None,
                    "name": re.sub(r"\s*\(IT26-\d{4}\)\s*$", "", label),
                }
            )
    return out


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _words(text: str, *, common: bool = False) -> set[str]:
    return {w for w in _norm(text).split() if len(w) > 2 and (common or w not in COMMON)}


def _score(label: str, team: Team, club: str = "") -> int:
    """
    How well a name in the sheet fits a team: the team's institution or name found whole in it (or it in them) counts most,
    then the club of a COE KIET / technical-club team, then words only they share, then common words ("public", "school")
    to break ties. 0: nothing in common.
    """
    wanted = _norm(label)
    score = 0
    for value in (team.institution, team.name):
        have = _norm(value)
        if len(have) > 3 and (have in wanted or wanted in have):
            score += 100
    # The sheet writes "Club – project": the club found whole in it counts, the project's words then tell two teams of one club apart.
    have_club = _norm(club)
    if len(have_club) > 3 and (have_club in wanted or wanted in have_club):
        score += 50
    fields = f"{team.name} {team.project_title} {team.institution} {club}"
    score += 10 * len(_words(label) & _words(fields))
    if score:
        score += len(_words(label, common=True) & _words(fields, common=True))
    return score


def preview(db: Session, admin: Admin, data: bytes) -> OctonormImportOut:
    if admin.role != "super_admin":
        raise ApiError("Only a super admin can import the octonorm list.", 403)
    stalls = parse_sheet(read_rows(data))
    if not stalls:
        raise ApiError("No octonorm rows were found. Upload the organisers' octonorm list (the sheet with Number and Team name & ID).", 422)
    numbers = [s["octonorm"] for s in stalls]
    if len(set(numbers)) != len(numbers):
        twice = next(n for n in numbers if numbers.count(n) > 1)
        raise ApiError(f"Octonorm {twice} is listed twice in the sheet.", 422)

    finale_teams = list(db.scalars(select(Team).where(judging._eligible_condition("final")).order_by(Team.number)))
    in_finale = {t.id for t in finale_teams}
    by_code = {t.code: t for t in db.scalars(select(Team).where(Team.number.in_([int(s["code"][5:]) for s in stalls if s["code"]])))}
    tents = dict(db.execute(select(FinalTent.team_id, FinalTent.tent)).tuples().all())
    holder = {tent: team_id for team_id, tent in tents.items()}
    section_of = sections.of_teams(db, finale_teams)
    clubs = sections.clubs_of(db, finale_teams)
    summaries = {s.id: s for s in admin_service.summaries(db, finale_teams + [t for t in by_code.values() if t.id not in in_finale])}
    used: set[uuid.UUID] = {t.id for s in stalls if s["code"] and (t := by_code.get(s["code"])) is not None}

    def candidate(team: Team, score: int) -> OctonormCandidateOut:
        return OctonormCandidateOut(team=summaries[team.id], octonorm=tents.get(team.id), club=clubs.get(team.id, ""), score=score)

    out: list[OctonormImportRowOut] = []
    for stall in stalls:
        holder_team = holder.get(stall["octonorm"])
        row = OctonormImportRowOut(
            octonorm=stall["octonorm"],
            section=stall["section"],
            category=stall["category"],
            label=stall["label"],
            code=stall["code"],
            held_by=summaries[holder_team].code if holder_team in summaries else None,
            status="unmatched",
        )
        if stall["code"]:
            team = by_code.get(stall["code"])
            if team is None:
                row.note = f"No team {stall['code']} on the site."
            elif team.id not in in_finale:
                row.team, row.status = summaries[team.id], "not_in_finale"
                row.note = f"{team.code} is not taking part in the Grand Finale (status {team.status}, result {team.result})."
            elif team.category != stall["category"] and _norm(team.name) != _norm(stall["name"]):
                # Neither the name nor the category fits: most likely a mistyped code. Offered, not chosen.
                used.discard(team.id)
                row.candidates = [candidate(team, 0)]
                row.note = (
                    f"{team.code} on the site is {team.name!r} in Category {team.category}, not {stall['name']!r} in Category "
                    f"{stall['category']}: check the code, then choose the team."
                )
            else:
                row.team, row.current = summaries[team.id], tents.get(team.id)
                row.status = "same" if row.current == stall["octonorm"] else "change"
                notes = []
                if team.category != stall["category"]:
                    notes.append(f"category {team.category} on the site, {stall['category']} in the sheet")
                if _norm(team.name) != _norm(stall["name"]):
                    notes.append(f"named {team.name!r} on the site")
                row.note = "; ".join(notes) or None
        else:
            pool = [
                t
                for t in finale_teams
                if t.id not in used
                and t.participant_type == KIND[stall["section"]]
                and (stall["section"] not in ("coe", "club") or t.department == rules.CLUB_DEPARTMENT)
            ]
            scored = sorted(
                ((_score(stall["label"], t, clubs.get(t.id, "")), t) for t in pool), key=lambda pair: (-pair[0], pair[1].number)
            )
            row.candidates = [candidate(t, s) for s, t in scored[:6] if s > 0]
            best = [pair for pair in scored if pair[0] > 0]
            # A clear match: the best has more words in common than the next one.
            if best and (len(best) == 1 or best[0][0] > best[1][0]):
                team = best[0][1]
                used.add(team.id)  # one stall per team: later rows do not offer it again
                row.team, row.current = summaries[team.id], tents.get(team.id)
                row.status = "same" if row.current == stall["octonorm"] else "change"
                row.section_now = section_of[team.id]
                row.note = "Matched by name: check it."
            else:
                row.note = "Choose the team: the name in the sheet matches none, or several equally."
        if row.team is not None and row.team.id in section_of:
            row.section_now = section_of[row.team.id]
        out.append(row)

    named = {r.team.id for r in out if r.team is not None}
    left = [summaries[t.id] for t in finale_teams if t.id not in named]
    return OctonormImportOut(
        rows=out,
        not_in_sheet=[OctonormCandidateOut(team=s, octonorm=tents.get(s.id), club=clubs.get(s.id, ""), score=0) for s in left],
    )
