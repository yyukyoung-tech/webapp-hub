"""Read an XLSX roster using only the Python standard library; never modify the source."""
import json, re, sys, zipfile
from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as ET

source, destination = map(Path, sys.argv[1:3])
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
students = []
with zipfile.ZipFile(source) as archive:
    strings = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in archive.namelist() else []
    for filename in sorted(archive.namelist()):
        if not re.fullmatch(r'xl/worksheets/sheet\d+\.xml', filename):
            continue
        rows = ET.fromstring(archive.read(filename)).findall('m:sheetData/m:row', ns)
        def values(row):
            result = {}
            for cell in row:
                column = re.sub(r'\d+', '', cell.attrib['r'])
                value = cell.find('m:v', ns)
                result[column] = (strings[int(value.text)] if cell.attrib.get('t') == 's' and value is not None else ''.join(cell.itertext())).strip()
            return result
        if not rows or [values(rows[0]).get(c) for c in 'ABCD'] != ['학년', '반', '번호', '성명']:
            raise ValueError('Unexpected roster header: ' + filename)
        for row in rows[1:]:
            data = values(row)
            if not data.get('D'):
                continue
            grade, classroom, number = (int(data[c]) for c in 'ABC')
            if min(grade, classroom, number) < 1:
                raise ValueError('Invalid student position')
            students.append({'grade': grade, 'class_no': classroom, 'student_number': str(number), 'student_name': data['D']})
keys = [(s['grade'], s['class_no'], s['student_number']) for s in students]
if not students or len(keys) != len(set(keys)):
    raise ValueError('Empty roster or duplicate grade/class/number')
students.sort(key=lambda s: (s['grade'], s['class_no'], int(s['student_number'])))
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps({'source': source.name, 'students': students}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'total': len(students), 'classes': dict(Counter(f"{s['grade']}-{s['class_no']}" for s in students))}))
