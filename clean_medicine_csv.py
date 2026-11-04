import csv
import re
from pathlib import Path

src = Path(r'C:\Users\Lenovo\Downloads\medicines.csv')


def clean_text(value: str) -> str:
    if value is None:
        return ''
    cleaned = re.sub(r'\s+', ' ', value)
    cleaned = cleaned.replace('*', '').strip(' ,;:.')
    return cleaned.strip()


def extract_composition(text: str) -> str:
    patterns = [
        r'contains\s+([A-Za-z0-9/\-\(\)\.\s]+?)(?:\s+which belongs|\s+which is|\s+as active ingredients|\s+as active ingredient|\s+as the active ingredients|$)',
        r'contains a combination of\s+([A-Za-z0-9/\-\(\)\.\s]+?)(?:\s+which belongs|\s+which is|\s+as active ingredients|$)',
        r'KEY COMPOSITION\s*([^\r\n]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.I | re.S)
        if match:
            result = match.group(1)
            result = re.sub(r'\s+', ' ', result)
            return clean_text(result)
    return ''


def extract_use(text: str) -> str:
    patterns = [
        r'It is used to manage\s+([^\.]+)',
        r'It is used in the management of\s+([^\.]+)',
        r'It is used for the management of\s+([^\.]+)',
        r'It is used in managing\s+([^\.]+)',
        r'It is used to treat\s+([^\.]+)',
        r'It is used for\s+([^\.]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.I | re.S)
        if match:
            return clean_text(match.group(1))
    if 'It is used' in text:
        start = text.find('It is used')
        segment = text[start:]
        end = segment.find('.')
        if end != -1:
            return clean_text(segment[:end])
    return ''


with src.open('r', encoding='utf-8', newline='') as infile:
    reader = csv.DictReader(infile)
    rows = []
    for row in reader:
        med_name = clean_text(row.get('med_name') or '')
        if not med_name:
            continue
        use = extract_use(row.get('drug_content') or '')
        composition = extract_composition(row.get('drug_content') or '')
        manufacturer = clean_text((row.get('drug_manufacturer') or '').replace('* Mkt: ', '').replace('*', ''))
        rows.append({
            'tablet_name': med_name,
            'use': use,
            'composition': composition,
            'manufactures': manufacturer,
        })

with src.open('w', encoding='utf-8', newline='') as outfile:
    writer = csv.DictWriter(outfile, fieldnames=['tablet_name', 'use', 'composition', 'manufactures'])
    writer.writeheader()
    writer.writerows(rows)

print(f'Processed {len(rows)} records into {src}')
print('Header:', ['tablet_name', 'use', 'composition', 'manufactures'])
print('Sample row:', rows[0] if rows else 'no rows')
