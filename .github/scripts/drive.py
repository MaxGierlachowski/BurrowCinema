"""Logs in through the UI and opens every tab, printing what is on screen. Used by smoke.sh."""
import re, subprocess, sys, time

def sh(*args):
    return subprocess.run(['adb', 'shell', *args], capture_output=True, text=True).stdout

def nodes():
    sh('uiautomator', 'dump', '/sdcard/ui.xml')
    return re.findall(r'<node [^>]*>', sh('cat', '/sdcard/ui.xml'))

def center(node):
    x1, y1, x2, y2 = map(int, re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node).groups())
    return str((x1 + x2) // 2), str((y1 + y2) // 2)

def texts():
    return [t for n in nodes() for t in re.findall(r' text="([^"]+)"', n)]

def tap_text(text, last=False):
    found = [n for n in nodes() if f' text="{text}"' in n]
    if not found:
        print(f'!! not found: {text}')
        return False
    sh('input', 'tap', *center(found[-1] if last else found[0]))
    return True

def alive():
    return sh('pidof', 'app.burrowcinema').strip() != ''

for index, value in enumerate(['http://10.0.2.2:8096', 'max', 'secret']):
    fields = [n for n in nodes() if 'android.widget.EditText' in n]
    sh('input', 'tap', *center(fields[index]))
    time.sleep(0.5)
    sh('input', 'text', value)
    time.sleep(0.3)
    sh('input', 'keyevent', '4')  # hide the keyboard so the next field is visible
    time.sleep(1)
tap_text('Anmelden', last=True)
time.sleep(10)
print('== after login, alive:', alive(), texts()[:25])

for tab in ['Suche', 'Auslosung', 'Ordner', 'Einstellungen', 'Bibliothek']:
    tap_text(tab, last=True)
    time.sleep(5)
    for allow in ['Allow', 'Zulassen']:  # notification permission dialog
        if allow in texts():
            tap_text(allow)
            time.sleep(2)
    print(f'== tab {tab}, alive: {alive()}', texts()[:20])

tap_text('Dune')
time.sleep(5)
print('== detail Dune, alive:', alive(), texts()[:20])

def tap_desc(desc):
    found = [n for n in nodes() if f'content-desc="{desc}"' in n]
    if not found:
        print(f'!! not found (desc): {desc}')
        return False
    sh('input', 'tap', *center(found[0]))
    return True

# Bottom sheets: add the open title to a new folder, then open the folder actions.
tap_text('Zu Ordner hinzufügen')
time.sleep(3)
print('== add to folder sheet, alive:', alive(), texts()[:15])
field = [n for n in nodes() if 'android.widget.EditText' in n]
if field:
    sh('input', 'tap', *center(field[0]))
    time.sleep(0.5)
    sh('input', 'text', 'Filmabend')
    sh('input', 'keyevent', '66')  # Enter submits and creates the folder
    time.sleep(3)
    print('== after create, alive:', alive(), texts()[:15])
sh('input', 'keyevent', '4')  # close the sheet
time.sleep(2)
sh('input', 'keyevent', '4')  # back to the library
time.sleep(2)
tap_text('Ordner', last=True)
time.sleep(4)
tap_text('Filmabend')
time.sleep(4)
print('== folder screen, alive:', alive(), texts()[:15])
tap_desc('Ordner Aktionen')
time.sleep(3)
print('== folder actions sheet, alive:', alive(), texts()[:15])
tap_text('Umbenennen')
time.sleep(3)
print('== rename sheet, alive:', alive(), texts()[:15])
