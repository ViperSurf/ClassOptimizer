#!/usr/bin/env python3
"""
scripts/build_uiuc_data.py
Dynamically discovers current and future published semesters from the UIUC CISApp REST API,
fetches course/section schedules asynchronously, joins Wade Fagen-Ulmschneider's GPA dataset,
and emits static JSON bundles + public/data/manifest.json.
"""

import argparse
import asyncio
import csv
import datetime
import hashlib
import io
import json
import os
import re
import statistics
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple
import aiohttp

CIS_ROOT_URL = "https://courses.illinois.edu/cisapp/explorer/schedule"
GPA_CSV_URL = "https://raw.githubusercontent.com/wadefagen/datasets/main/gpa/uiuc-gpa-dataset.csv"

SEASON_ORDER = {"winter": 1, "spring": 2, "summer": 3, "fall": 4}
DAY_MAP = {"M": "M", "T": "T", "W": "W", "R": "R", "F": "F", "S": "S", "U": "U"}

def compute_term_dates(year: int, season: str) -> Tuple[str, str, str]:
    """Computes approximate start, midterm (Part A->B), and end ISO dates for a given year/season."""
    if season == "fall":
        return (f"{year}-08-24", f"{year}-10-19", f"{year}-12-09")
    elif season == "spring":
        return (f"{year}-01-19", f"{year}-03-15", f"{year}-05-05")
    elif season == "summer":
        return (f"{year}-05-18", f"{year}-06-15", f"{year}-08-06")
    return (f"{year}-12-21", f"{year}-01-04", f"{year + 1}-01-15")

def parse_time_str(raw_time: Optional[str]) -> Tuple[int, str]:
    """Converts '11:00 AM' or '02:50 PM' to (minutes_from_midnight, 'HH:mm')."""
    if not raw_time or "ARR" in raw_time.upper():
        return (-1, "ARR")
    match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", raw_time.strip(), re.IGNORECASE)
    if not match:
        return (-1, "ARR")
    hour, minute, meridiem = int(match.group(1)), int(match.group(2)), match.group(3).upper()
    if meridiem == "PM" and hour != 12:
        hour += 12
    elif meridiem == "AM" and hour == 12:
        hour = 0
    return (hour * 60 + minute, f"{hour:02d}:{minute:02d}")

def infer_link_metadata(section_num: str, section_type: str, all_sections_meta: List[Tuple[str, str]]) -> Tuple[str, str]:
    """
    Infers Ellucian Banner section linking rules for UIUC courses.
    Example: AL1 (LEC) + AD1..AD9 (DIS) share linkGroup='A'.
    If a course has BOTH Lectures (LEC) and Discussions/Labs (DIS/LAB/Q):
      - Lectures are PRIMARY
      - Discussions/Labs are SECONDARY
    If all lectures start with 'A' (AL1, AL2) and discussions start with 'A' (AD1, AD2), group is 'A'.
    """
    has_lec = any(t == "LEC" for _, t in all_sections_meta)
    has_sub = any(t in ("DIS", "LAB", "Q") for _, t in all_sections_meta)
    sec_clean = (section_num or "").strip().upper()
    prefix_char = sec_clean[0] if sec_clean and sec_clean[0].isalpha() else "ALL"

    if not (has_lec and has_sub):
        return ("ALL", "STANDALONE")
    if section_type == "LEC":
        return (prefix_char, "PRIMARY")
    if section_type in ("DIS", "LAB", "Q"):
        # Check if any lecture shares this prefix_char; if not, bind to 'ALL'
        lec_prefixes = {s[0].upper() for s, t in all_sections_meta if t == "LEC" and s and s[0].isalpha()}
        group = prefix_char if prefix_char in lec_prefixes else "ALL"
        return (group, "SECONDARY")
    return ("ALL", "STANDALONE")

async def fetch_text(session: aiohttp.ClientSession, url: str, semaphore: asyncio.Semaphore) -> Optional[str]:
    async with semaphore:
        for attempt in range(3):
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=25)) as resp:
                    if resp.status == 200:
                        return await resp.text()
                    elif resp.status == 404:
                        return None
            except Exception:
                await asyncio.sleep(0.5 * (attempt + 1))
        return None

async def discover_terms(session: aiohttp.ClientSession, sem: asyncio.Semaphore) -> List[Tuple[int, str]]:
    """Queries CISApp root XML to discover all published current and future semesters."""
    root_xml = await fetch_text(session, f"{CIS_ROOT_URL}.xml", sem)
    if not root_xml:
        now = datetime.date.today()
        return [(now.year, "spring"), (now.year, "fall")]

    root = ET.fromstring(root_xml)
    current_year = datetime.date.today().year
    candidate_years = [
        int(el.attrib.get("id", el.text or 0))
        for el in root.findall(".//calendarYear")
        if int(el.attrib.get("id", el.text or 0)) >= current_year - 1
    ]

    discovered: List[Tuple[int, str]] = []
    for yr in sorted(set(candidate_years)):
        yr_xml = await fetch_text(session, f"{CIS_ROOT_URL}/{yr}.xml", sem)
        if not yr_xml:
            continue
        yr_root = ET.fromstring(yr_xml)
        for term_el in yr_root.findall(".//term"):
            term_id = term_el.attrib.get("id", "").lower()
            for season in ("winter", "spring", "summer", "fall"):
                if season in term_id:
                    discovered.append((yr, season))
    discovered.sort(key=lambda x: (x[0], SEASON_ORDER.get(x[1], 0)))
    return discovered

async def load_gpa_lookup(session: aiohttp.ClientSession, sem: asyncio.Semaphore) -> Tuple[Dict[str, dict], Dict[str, float]]:
    """Downloads UIUC GPA CSV and aggregates metrics by (Course, Instructor) and (Course)."""
    csv_text = await fetch_text(session, GPA_CSV_URL, sem)
    by_instructor: Dict[str, dict] = {}
    by_course: Dict[str, List[float]] = {}
    if not csv_text:
        return by_instructor, {}

    reader = csv.DictReader(io.StringIO(csv_text))
    accum: Dict[Tuple[str, str], dict] = {}
    for row in reader:
        subj = row.get("Subject", "").strip().upper()
        num = row.get("Number", "").strip()
        instr = row.get("Primary Instructor", "").strip()
        if not subj or not num:
            continue
        course_id = f"{subj} {num}"
        grade_weights = [
            ("A+", 4.0), ("A", 4.0), ("A-", 3.67),
            ("B+", 3.33), ("B", 3.0), ("B-", 2.67),
            ("C+", 2.33), ("C", 2.0), ("C-", 1.67),
            ("D+", 1.33), ("D", 1.0), ("D-", 0.67), ("F", 0.0)
        ]
        total_students = 0
        weighted_sum = 0.0
        a_count = 0
        for col, pts in grade_weights:
            cnt = int(row.get(col, 0) or 0)
            total_students += cnt
            weighted_sum += cnt * pts
            if col in ("A+", "A", "A-"):
                a_count += cnt
        if total_students == 0:
            continue
        term_gpa = weighted_sum / total_students
        by_course.setdefault(course_id, []).append(term_gpa)
        if instr:
            key = (course_id, instr)
            entry = accum.setdefault(key, {"students": 0, "weighted": 0.0, "a_cnt": 0, "gpas": []})
            entry["students"] += total_students
            entry["weighted"] += weighted_sum
            entry["a_cnt"] += a_count
            entry["gpas"].append(term_gpa)

    for (course_id, instr), data in accum.items():
        avg_gpa = round(data["weighted"] / data["students"], 2)
        pct_a = round((data["a_cnt"] / data["students"]) * 100.0, 1)
        std_dev = round(statistics.pstdev(data["gpas"]), 2) if len(data["gpas"]) > 1 else 0.0
        by_instructor[f"{course_id}|{instr}"] = {
            "courseCode": course_id,
            "instructor": instr,
            "averageGpa": avg_gpa,
            "percentAs": pct_a,
            "sampleSize": data["students"],
            "gpaStdDev": std_dev,
            "semestersSampled": len(data["gpas"]),
        }

    course_avg_map = {cid: round(sum(vals) / len(vals), 2) for cid, vals in by_course.items() if vals}
    return by_instructor, course_avg_map

async def fetch_course_detail(
    session: aiohttp.ClientSession,
    sem: asyncio.Semaphore,
    year: int,
    season: str,
    subject: str,
    number: str,
    gpa_by_instr: Dict[str, dict],
    gpa_by_course: Dict[str, float],
) -> Optional[dict]:
    url = f"{CIS_ROOT_URL}/{year}/{season}/{subject}/{number}.xml?mode=detail"
    xml_text = await fetch_text(session, url, sem)
    if not xml_text:
        return None
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    course_id = f"{subject} {number}"
    title = (root.findtext("label") or "").strip()
    description = (root.findtext("description") or "").strip()
    credit_text = (root.findtext("creditHours") or "3 hours.").strip()
    nums = [int(n) for n in re.findall(r"\d+", credit_text)]
    cred_min = nums[0] if nums else 3
    cred_max = nums[-1] if nums else cred_min

    gen_eds = [cat.findtext("description", "").strip() for cat in root.findall(".//genEdCategories/category") if cat.findtext("description")]
    section_els = root.findall(".//detailedSections/detailedSection")

    # Pre-scan section numbers and types for accurate linkGroup inference
    raw_meta: List[Tuple[str, str]] = []
    for sec_el in section_els:
        s_num = (sec_el.findtext("sectionNumber") or "").strip()
        m_el = sec_el.find(".//meeting")
        s_type = (m_el.findtext("type", "LEC") if m_el is not None else "LEC").strip()
        type_code = m_el.find("type").attrib.get("code", "LEC").strip() if (m_el is not None and m_el.find("type") is not None) else "LEC"
        raw_meta.append((s_num, type_code))

    sections = []
    for idx, sec_el in enumerate(section_els):
        crn = sec_el.attrib.get("id", "").strip()
        sec_num = (sec_el.findtext("sectionNumber") or "A").strip()
        sec_title = (sec_el.findtext("sectionTitle") or "").strip() or None
        pot_raw = (sec_el.findtext("partOfTerm") or "1").strip().upper()
        part_of_term = pot_raw if pot_raw in ("1", "A", "B", "SF") else "1"
        status_text = (sec_el.findtext("enrollmentStatus") or "Unknown").strip()
        if "Open" in status_text:
            status = "Open"
        elif "Closed" in status_text:
            status = "Closed"
        else:
            status = "Unknown"

        meetings = []
        primary_type_code = raw_meta[idx][1]
        primary_instructor = ""

        for m_el in sec_el.findall(".//meeting"):
            days_raw = (m_el.findtext("daysOfTheWeek") or "").strip()
            days = [DAY_MAP[ch] for ch in days_raw if ch in DAY_MAP]
            start_min, start_str = parse_time_str(m_el.findtext("start"))
            end_min, end_str = parse_time_str(m_el.findtext("end"))
            bldg_code = m_el.findtext("buildingName", "").strip()
            room = m_el.findtext("roomNumber", "").strip()
            instructors = [
                (ins.text or "").strip()
                for ins in m_el.findall(".//instructors/instructor")
                if (ins.text or "").strip()
            ]
            if instructors and not primary_instructor:
                primary_instructor = instructors[0]
            meetings.append({
                "daysOfWeek": days,
                "startMinutes": start_min,
                "endMinutes": end_min,
                "startTime": start_str,
                "endTime": end_str,
                "buildingCode": bldg_code,
                "buildingName": bldg_code,
                "room": room,
                "instructors": instructors,
            })

        # Determine delivery mode
        if primary_type_code == "ONL" or all(m["startMinutes"] == -1 for m in meetings):
            delivery_mode = "Online Async" if all(m["startMinutes"] == -1 for m in meetings) else "Online Sync"
        else:
            delivery_mode = "In-Person"

        link_group, link_role = infer_link_metadata(sec_num, primary_type_code, raw_meta)
        grade_metric = gpa_by_instr.get(f"{course_id}|{primary_instructor}")

        sections.append({
            "crn": crn,
            "courseId": course_id,
            "sectionNumber": sec_num,
            "sectionTitle": sec_title,
            "type": primary_type_code if primary_type_code in ("LEC", "DIS", "LAB", "LBD", "Q", "ONL", "IND", "CONF", "PKG") else "LEC",
            "deliveryMode": delivery_mode,
            "partOfTerm": part_of_term,
            "linkGroup": link_group,
            "linkRole": link_role,
            "meetings": meetings,
            "enrollmentStatus": status,
            "statusText": status_text,
            "restrictions": [r.strip() for r in [sec_el.findtext("sectionText"), sec_el.findtext("specialApproval")] if r and r.strip()],
            "gradeMetric": grade_metric,
        })

    return {
        "id": course_id,
        "campusId": "uiuc",
        "term": f"{year}-{season}",
        "subject": subject,
        "number": number,
        "title": title,
        "description": description,
        "creditHoursMin": cred_min,
        "creditHoursMax": cred_max,
        "genEdCategories": gen_eds,
        "crossListedWith": [],
        "offeringPattern": "Fall & Spring",
        "restrictions": [],
        "prerequisitesText": (root.findtext("courseSectionInformation") or "").strip(),
        "unlocksCourses": [],
        "courseAverageGpa": gpa_by_course.get(course_id),
        "sections": sections,
    }

async def build_term_bundle(
    session: aiohttp.ClientSession,
    sem: asyncio.Semaphore,
    year: int,
    season: str,
    gpa_by_instr: Dict[str, dict],
    gpa_by_course: Dict[str, float],
    subjects_filter: Optional[List[str]] = None,
) -> Optional[dict]:
    term_slug = f"{year}-{season}"
    term_xml = await fetch_text(session, f"{CIS_ROOT_URL}/{year}/{season}.xml", sem)
    if not term_xml:
        return None

    term_root = ET.fromstring(term_xml)
    subjects = [el.attrib.get("id", "").strip() for el in term_root.findall(".//subject") if el.attrib.get("id")]
    if subjects_filter:
        subjects = [s for s in subjects if s in subjects_filter]

    course_refs: List[Tuple[str, str]] = []
    subj_tasks = [fetch_text(session, f"{CIS_ROOT_URL}/{year}/{season}/{subj}.xml", sem) for subj in subjects]
    subj_xmls = await asyncio.gather(*subj_tasks)

    for subj, s_xml in zip(subjects, subj_xmls):
        if not s_xml:
            continue
        s_root = ET.fromstring(s_xml)
        for c_el in s_root.findall(".//course"):
            c_num = c_el.attrib.get("id", "").strip()
            if c_num:
                course_refs.append((subj, c_num))

    detail_tasks = [
        fetch_course_detail(session, sem, year, season, subj, c_num, gpa_by_instr, gpa_by_course)
        for subj, c_num in course_refs
    ]
    courses_raw = await asyncio.gather(*detail_tasks)
    courses = [c for c in courses_raw if c and c["sections"]]

    start_date, mid_date, end_date = compute_term_dates(year, season)
    return {
        "campusId": "uiuc",
        "term": term_slug,
        "label": f"{season.capitalize()} {year}",
        "generatedAtIso": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "startDate": start_date,
        "midTermDate": mid_date,
        "endDate": end_date,
        "courses": courses,
    }

async def async_main():
    parser = argparse.ArgumentParser(description="Build UIUC dynamic semester bundles")
    parser.add_argument("--terms", nargs="*", help="Optional explicit terms e.g. 2026-fall 2027-spring (auto-discovers if omitted)")
    parser.add_argument("--subjects", nargs="*", help="Optional subset of subjects for fast dev builds e.g. CS ECE MATH")
    args = parser.parse_args()

    os.makedirs("public/data/terms", exist_ok=True)
    sem = asyncio.Semaphore(24)

    async with aiohttp.ClientSession(headers={"User-Agent": "ClassOptimizer-DataPipeline/2.0"}) as session:
        gpa_by_instr, gpa_by_course = await load_gpa_lookup(session, sem)

        if args.terms:
            target_terms = []
            for t in args.terms:
                yr_str, seas = t.lower().split("-")
                target_terms.append((int(yr_str), seas))
        else:
            target_terms = await discover_terms(session, sem)
            # Keep the most recent 4 published terms (current + future terms)
            target_terms = target_terms[-4:]

        manifest_terms = []
        today_iso = datetime.date.today().isoformat()

        for yr, season in target_terms:
            bundle = await build_term_bundle(session, sem, yr, season, gpa_by_instr, gpa_by_course, args.subjects)
            if not bundle or not bundle["courses"]:
                continue
            slug = bundle["term"]
            rel_path = f"data/terms/uiuc-{slug}.json"
            full_path = os.path.join("public", rel_path)
            payload_bytes = json.dumps(bundle, separators=(",", ":")).encode("utf-8")
            with open(full_path, "wb") as f:
                f.write(payload_bytes)
            sha256_hash = hashlib.sha256(payload_bytes).hexdigest()

            is_current = bundle["startDate"] <= today_iso <= bundle["endDate"]
            is_upcoming = bundle["startDate"] > today_iso

            manifest_terms.append({
                "slug": slug,
                "year": yr,
                "season": season,
                "label": bundle["label"],
                "campusId": "uiuc",
                "isCurrent": is_current,
                "isUpcomingRegistration": is_upcoming,
                "startDate": bundle["startDate"],
                "midTermDate": bundle["midTermDate"],
                "endDate": bundle["endDate"],
                "lastUpdatedIso": bundle["generatedAtIso"],
                "courseCount": len(bundle["courses"]),
                "bundlePath": rel_path,
                "sha256": sha256_hash,
            })

        # Select smart default term: prefer upcoming registration term if within 90 days, else current term, else latest
        default_slug = manifest_terms[-1]["slug"] if manifest_terms else "2026-fall"
        for mt in manifest_terms:
            if mt["isUpcomingRegistration"]:
                default_slug = mt["slug"]
                break
            if mt["isCurrent"]:
                default_slug = mt["slug"]

        manifest = {
            "generatedAtIso": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "defaultTermByCampus": {"uiuc": default_slug, "uic": default_slug, "uis": default_slug},
            "terms": manifest_terms,
        }
        with open("public/data/manifest.json", "w", encoding="utf-8") as mf:
            json.dump(manifest, mf, indent=2)

if __name__ == "__main__":
    asyncio.run(async_main())
