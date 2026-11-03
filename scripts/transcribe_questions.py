"""Build the 2026 question bank from the supplied question scans, without the spreadsheet."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR_PATH = ROOT / ".ocr_cropped_2026.json"
NARROW_OCR_PATH = ROOT / ".ocr_narrow_2026.json"
USE_NARROW = {(1, 91), (1, 100), (1, 109), (2, 51)}
QUESTION_PATH = ROOT / "questions.js"
LABEL = re.compile(r"\(\s*([A-Za-z]{0,2})\s*\)")
VISUAL = {
    1: {3, 5, 19, 20, 44, 94, 107, 110},
    2: {8, 11, 16, 18, 19, 22, 24, 25, 27, 34, 38, 54, 58},
}

CASE_113 = (
    "A 6-week-old infant has a history of fever for 2 days and, according to the mother, "
    "is not feeding well, taking 2–3 breastfeeds a day. The infant has diarrhoea for the "
    "last 2 days and sunken eyes. Pus is draining from the umbilicus, and the infant has "
    "a respiratory rate of 55 breaths per minute."
)
CASE_115 = (
    "Mrs. M is a poor migrant worker who recently moved to a village with her husband "
    "to work in the local brick kiln. The ASHA learns that she has missed her last period. "
    "Her last menstrual period was 6 January, and the ASHA visited on 4 March of the same year. "
    "She has never delivered a child or had an abortion. She is 28 years old, 144 cm tall, "
    "weighs 52 kg, and her haemoglobin is 11.6 g/dL."
)


def clean(value: str) -> str:
    value = value.replace("\ufffd", "'").replace("\u00a0", " ")
    value = re.sub(r"[|/]\s*\d{1,3}[.,]\s*", " ", value)
    value = value.replace("|", " ").replace("\\", " ")
    value = re.sub(r"\s+\[\s*$", "", value)
    value = re.sub(r"\s*\[?\s*P\.?T\.?O\.?\s*\]?", "", value, flags=re.I)
    value = re.sub(r"\s*['I]?T?DC[-–][A-Z0-9/(). -]+$", "", value, flags=re.I)
    value = re.sub(r"\s+[A-D]\)$", "", value)
    value = re.sub(r"\\\)$", "", value)
    value = re.sub(r"(?im)^\s*(?:NTDC|NTDO|NTDG|www\.|prepp\b)[^\n]*$", "", value)
    value = re.sub(r"(?m)^\s*\(?\s*\d+\s*[-–]\s*[A-Z]?\)?\s*$", "", value)
    value = re.sub(r"\s+-\s+", "-", value)
    value = re.sub(r"(?<=\w)-\s+(?=\w)", "-", value)
    value = re.sub(r"\s+", " ", value).strip(" \t|;:,.—-")
    value = value.strip("[]{} ")
    value = re.sub(r"^(?:\+|\}|\)\.)\s*", "", value)
    value = value.replace("Itis ", "It is ").replace("_ ", "")
    return value


def parse(raw: str, paper: int, number: int) -> tuple[str, list[str]]:
    markers = list(LABEL.finditer(raw))[-4:]
    if len(markers) != 4:
        return "", ["", "", "", ""]
    stem = raw[: markers[0].start()]
    stem = re.sub(r"^.{0,16}?\d{1,3}[.,]\s*", "", stem, count=1)
    stem = clean(stem)
    options = []
    for i, marker in enumerate(markers):
        end = markers[i + 1].start() if i < 3 else len(raw)
        options.append(clean(raw[marker.end() : end]))
    return stem, options


def normalize_option(value: str) -> str:
    if re.fullmatch(r"[0-9lBSN,\sandoly()]+", value, flags=re.I):
        value = re.sub(r"^l(?=\s*(?:and|only))", "1", value, flags=re.I)
        value = re.sub(r"^[BS](?=3\s*and)", "", value)
        value = re.sub(r"^Sand(?=4)", "3 and ", value)
        value = re.sub(r"(?<=\d)and\s*(\d)", r" and \1", value)
        value = re.sub(r"\band\s*(\d)", r"and \1", value)
        value = re.sub(r"(?<=\d),(?=\d)", ", ", value)
        value = re.sub(r"(?<=\d)only\b", " only", value, flags=re.I)
        value = re.sub(r"\s+(?:N|A\)|62|75|18)$", "", value)
        value = value.rstrip(" ()")
        value = re.sub(r"\s+", " ", value).strip()
    return value


def apply_corrections(paper: int, number: int, stem: str, options: list[str]) -> tuple[str, list[str]]:
    key = (paper, number)
    if key == (1, 46):
        options = [
            "Inability to identify common objects by palpation, recognizing their shape, texture and size",
            "Inability to recognize, with eyes closed, letters or numbers drawn by the examiner's fingertip on the palm of the hand",
            "Inability to discriminate two points set 3 mm apart on the fingertips",
            "Inability to stand and walk with both eyes closed",
        ]
        stem = "Which one of the following refers to agraphesthesia?"
    elif key == (1, 79):
        stem = (
            "Consider the following statements regarding Dual X-ray Absorptiometry (DXA): "
            "1. DXA is used to measure bone mineral density. "
            "2. It works on the principle that calcium in bone attenuates the passage of X-rays "
            "through tissue in proportion to the amount of mineral present. "
            "3. Osteoporosis is defined to be present when the T-score lies between (−1.0) "
            "and below (+2.5). 4. Co-existing conditions, such as aortic calcification or "
            "degenerative disc disease, can cause high bone mineral density even in the "
            "presence of osteoporosis. Which of the statements above are correct?"
        )
        options = ["1, 2 and 3", "1, 2 and 4", "1, 3 and 4", "2, 3 and 4"]
    elif key == (1, 80):
        stem = (
            "Which of the following classical disease-modifying antirheumatic drugs are "
            "considered safe for use during pregnancy? 1. Methotrexate 2. Sulfasalazine "
            "3. Hydroxychloroquine 4. Leflunomide. Select the correct answer using the code given below."
        )
        options = ["1 only", "1 and 3 only", "2 and 3", "1, 3 and 4"]
    elif key == (2, 4):
        stem = (
            "An infant is brought to the clinic by the parents with a swelling in the neck "
            "since birth. On examination, the swelling is soft, partially compressible and "
            "brilliantly transilluminant. What is the most likely diagnosis?"
        )
        options = ["Sternomastoid tumour", "Branchial cyst", "Thyroglossal cyst", "Cystic hygroma"]
    elif key == (2, 33):
        stem = (
            "A 25-year-old motorcycle rider is brought to the emergency department after a "
            "motor vehicle accident. On primary survey, he opens his eyes in response to pain, "
            "speaks inappropriate words and localizes pain. What is his Glasgow Coma Scale score?"
        )
        options = ["E3 V4 M4", "E2 V3 M5", "E3 V3 M4", "E2 V4 M5"]
    elif key == (2, 105):
        stem = (
            "Consider these organizations in the history of international health: "
            "1. Health Organization of the League of Nations; 2. Pan American Sanitary Bureau; "
            "3. United Nations Relief and Rehabilitation Administration; 4. World Health Organization. "
            "Which sequence gives their establishment from oldest to newest?"
        )
        options = ["1 → 2 → 4 → 3", "1 → 3 → 4 → 2", "2 → 4 → 1 → 3", "2 → 1 → 3 → 4"]
    elif key == (2, 118):
        options[3] = "None of the above"
    elif key == (2, 81):
        stem = (
            "In the history of public health, as a part of modern medicine, the following four "
            "distinct phases can be demarcated: 1. Health for All phase; 2. Health promotional "
            "phase; 3. Disease control phase; 4. Social engineering phase. Which one of the "
            "following represents the correct sequence of the phases in chronological order "
            "(from the oldest to the newest)?"
        )
        options = ["1 -> 3 -> 2 -> 4", "2 -> 4 -> 1 -> 3", "3 -> 2 -> 4 -> 1", "4 -> 1 -> 3 -> 2"]
    elif key == (2, 120):
        stem = (
            "Although different triage systems have been used as a part of disaster response, "
            "the most common classification uses the following internationally accepted "
            "four-colour code system: 1. Black; 2. Green; 3. Red; 4. Yellow. Which one among "
            "the following correctly represents the descending order (from the highest to the "
            "lowest) of priority for medical care and transportation to health centres?"
        )
        options = ["1 -> 3 -> 4 -> 2", "2 -> 4 -> 1 -> 3", "3 -> 4 -> 2 -> 1", "3 -> 2 -> 4 -> 1"]
    elif key == (1, 25):
        options[3] = "3rd generation cephalosporins"
    elif key == (1, 38):
        options = ["1", "2", "3A", "3B"]
    elif key == (1, 99):
        stem = (
            "A 5-year-old boy who was started on treatment for Burkitt lymphoma develops acute "
            "onset respiratory distress and decreased urine output. Investigations reveal: "
            "Hb 8 g/dL, TLC 15000/mm³, platelet count 1 lakh/mm³, serum potassium 6.5 mEq/L, "
            "corrected serum calcium 6.7 mg/dL and serum creatinine 2 mg/dL. The most important "
            "drug for emergency management is:"
        )
        options = ["Dexamethasone", "Broad-spectrum antibiotics", "Rasburicase", "Folinic acid rescue"]
    elif key == (1, 91):
        stem = (
            "A 26-year-old female complains of severe fatigue and myalgia. Examination reveals "
            "pallor and mild splenomegaly. Haematological investigations show haemoglobin "
            "10 g/dL, a microcytic hypochromic peripheral smear with anisocytosis, reticulocyte "
            "count 5%, and serum ferritin 300 microgram/L. What is the most likely underlying diagnosis?"
        )
        options = ["Iron deficiency", "Folic acid deficiency", "Vitamin B12 deficiency", "Beta-thalassemia"]
    elif key == (1, 97):
        stem = stem.replace("mm*", "mm³").replace("1200 pg/L", "1200 microgram/L")
        options[3] = "Acute promyelocytic leukemia"
    elif key == (1, 109):
        options = ["Flumazenil", "Adrenaline", "Pralidoxime", "Naloxone"]
    elif key == (1, 112):
        options = ["1 and 2", "2 and 3", "1 and 4", "2 and 4"]
    elif key == (1, 110):
        stem = (
            "A neonate is noted to have bilious vomiting at 6 hours of life with abdominal "
            "distention. An X-ray is ordered (see image). The most likely diagnosis is:"
        )
        options = ["Pyloric stenosis", "Esophageal atresia", "Duodenal atresia", "Hirschsprung's disease"]
    elif key == (1, 24):
        stem = stem.replace("predominant symm of diarrhea", "predominant symptom of diarrhea")
    elif key == (1, 26):
        stem = stem.replace("symmatic relief", "symptomatic relief")
    elif key == (1, 28):
        stem = stem.replace("regarding 30. ", "regarding ")
    elif key == (1, 32):
        options[1] = "Myocarditis"
    elif key == (1, 59):
        options[3] = "Beta-blockers"
    elif key == (1, 55):
        options = ["Level 0", "Level 1", "Level 2", "Level 3"]
    elif key == (1, 45):
        stem = stem.replace("arm ¢< 6", "arm less than 6")
        options[3] = "Pons"
    elif key == (1, 117):
        options[3] = "Amphotericin B deoxycholate, IV, 30 doses"
    elif key == (2, 30):
        options[3] = "uveitis"
    elif key == (2, 89):
        stem = "Which of the following correctly represents 'late expanding', i.e., the third stage in the demographic cycle?"
        options[1] = "Decline in death rates and decline in birthrates"
    elif key == (2, 85):
        options = ["22.4%", "86.5%", "95.5%", "67.0%"]
    elif key == (2, 95):
        options = ["3 grams", "12 grams", "9 grams", "6 grams"]
    elif key == (2, 101):
        stem = stem.replace("16 meters", "1.6 meters")
    elif key == (2, 96):
        options = [
            "0.0475 inch in diameter", "0.00475 inch in diameter",
            "0.0475 centimeter in diameter", "0.00475 centimeter in diameter",
        ]
    elif key == (2, 111):
        options = ["35", "55", "75", "105"]
    elif key == (2, 114):
        stem = stem.replace("appropriate 11 treatment", "appropriate treatment")
    elif key == (2, 51):
        options = [
            "At 24 to 28 weeks of pregnancy and/or repeat at 30 to 32 weeks of pregnancy",
            "Early in pregnancy and/or repeat at 24 to 28 weeks of pregnancy",
            "Early in pregnancy and/or repeat at 30 to 32 weeks of pregnancy",
            "At 9 to 11 weeks of pregnancy and/or repeat at 30 to 32 weeks of pregnancy",
        ]
    return stem, options


def load_original() -> tuple[dict, dict]:
    source = QUESTION_PATH.read_text(encoding="utf-8")
    subjects = re.search(r"const SUBJECTS\s*=\s*(\{[\s\S]*?\});", source)
    questions = re.search(r"const QUESTIONS_DATA\s*=\s*(\{[\s\S]*?\});", source)
    if not subjects or not questions:
        raise ValueError("Could not read existing question data")
    return json.loads(subjects.group(1)), json.loads(questions.group(1))


def main() -> None:
    subjects, database = load_original()
    ocr = json.loads(OCR_PATH.read_text(encoding="utf-8"))
    narrow_ocr = json.loads(NARROW_OCR_PATH.read_text(encoding="utf-8"))
    issues = []
    for paper in (1, 2):
        for question in database[f"paper{paper}"]["questions"]:
            number = question["id"]
            scan = f"p{paper}-q{number:03d}.webp"
            raw = narrow_ocr[scan]["text"] if (paper, number) in USE_NARROW else ocr[scan]["text"]
            stem, options = parse(raw, paper, number)
            stem, options = apply_corrections(paper, number, stem, options)
            options = [normalize_option(choice) for choice in options]
            if not stem or any(not choice for choice in options):
                issues.append(f"Paper {paper} question {number}: missing stem or choice")
            question["text"] = stem
            question["options"] = options
            question["sourceScan"] = f"assets/questions-2026/{scan}"
            if number in VISUAL[paper]:
                question["image"] = question["sourceScan"]
            else:
                question.pop("image", None)
            question.pop("contextImage", None)
            if paper == 2 and number in (113, 114):
                question["contextText"] = CASE_113
            elif paper == 2 and 115 <= number <= 119:
                question["contextText"] = CASE_115
    if issues:
        raise ValueError("\n".join(issues))
    output = (
        "// UPSC CMS 2026 Series A. Questions and choices transcribed from the supplied scans.\n"
        "// Answers remain from the supplied provisional answer key.\n"
        f"const SUBJECTS = {json.dumps(subjects, ensure_ascii=False, indent=2)};\n\n"
        f"const QUESTIONS_DATA = {json.dumps(database, ensure_ascii=False, indent=2)};\n"
    )
    QUESTION_PATH.write_text(output, encoding="utf-8")
    print("Wrote 240 questions. Image questions:", sum(len(values) for values in VISUAL.values()))


if __name__ == "__main__":
    main()
