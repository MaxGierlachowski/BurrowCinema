"""Android TV smoke driver: only D pad, back and media keys, like a remote. Used by smoke.sh tv."""
import re, time
from drive import (PKG, SECOND, alive, check, finish, find, hide_keyboard, key, label, nodes, report, reports, sh, step, texts,
                   wait_for, wait_report)

SIDEBAR = {'Start', 'Suche', 'Filme', 'Serien', 'Ordner', 'Einstellungen'}


def in_front():
    return PKG in ''.join(re.findall(r'ResumedActivity.*', sh('dumpsys', 'activity', 'activities')))


def focused():
    """Texts of the focused node and its children, for example the title on a focused card."""
    for node in nodes():
        if node.get('focused') == 'true':
            return [label(n) for n in node.iter('node') if label(n)] or [node.get('class', '')]
    return []


def shows(labels, text):
    return any(text in t for t in labels)


def in_sidebar(labels):
    return any(t in SIDEBAR for t in labels)


def focus_to(text, direction, presses=12):
    """Presses the direction until a focused node shows the text."""
    for _ in range(presses + 1):
        if shows(focused(), text):
            return True
        key(f'KEYCODE_DPAD_{direction}')
    return False


def scan_for(text, rows=4, presses=6):
    """Walks the home rows: right along a row, back to its start, then one row down."""
    for _ in range(rows):
        if focus_to(text, 'RIGHT', presses):
            return True
        for _ in range(presses):
            key('KEYCODE_DPAD_LEFT')
            current = focused()
            if shows(current, text):
                return True
            if in_sidebar(current):
                key('KEYCODE_DPAD_RIGHT')
                break
        key('KEYCODE_DPAD_DOWN')
    return shows(focused(), text)


def login():
    step('login')
    if not wait_for('Mit Quick Connect anmelden', 20):
        return check('login screen', False)
    if not focused():
        key('KEYCODE_DPAD_DOWN')  # some TVs only show focus after the first key
    check('a node is focused on the login screen', focused())
    # The server field is the first input; typed keys reach a focused field without opening the keyboard.
    for _ in range(4):
        fields = [n for n in nodes() if n.get('class') == 'android.widget.EditText']
        if fields and fields[0].get('focused') == 'true':
            break
        key('KEYCODE_DPAD_UP')
    sh('input', 'text', 'http://10.0.2.2:8096')
    time.sleep(1)
    if not find('http://10.0.2.2:8096'):
        key('KEYCODE_DPAD_CENTER', pause=1.5)
        sh('input', 'text', 'http://10.0.2.2:8096')
        time.sleep(1)
        hide_keyboard(when_unknown=False)
    check('server address entered', find('http://10.0.2.2:8096'))
    if not check('focus Mit Quick Connect anmelden', focus_to('Mit Quick Connect anmelden', 'DOWN')):
        return False
    key('KEYCODE_DPAD_CENTER')
    check('Quick Connect code 482913 shown', wait_for('482913', 5), must=False)  # visible for about 3 s only
    return check('home after Quick Connect', wait_for('Weiterschauen', 15))


def home():
    step('home')
    found = texts()
    for title in ['Start', 'Suche', 'Filme', 'Serien', 'Ordner', 'Einstellungen']:
        check(f'sidebar label {title}', title in found)
    for title in ['Weiterschauen', 'Nächste Folgen', 'Zuletzt hinzugefügt: Filme']:
        check(f'home row {title}', title in found, must=title == 'Weiterschauen')
    check('auslosung hidden on TV', 'Auslosung' not in found)
    start = focused()
    check('a node is focused on home', start, str(start))
    for _ in range(5):
        if in_sidebar(focused()):
            break
        key('KEYCODE_DPAD_LEFT')
    check('DPAD_LEFT reaches the sidebar', in_sidebar(focused()), str(focused()))
    key('KEYCODE_DPAD_RIGHT', pause=1)
    check('DPAD_RIGHT returns to the content', not in_sidebar(focused()) and focused(), str(focused()))


def resume_arrival():
    step('Arrival')
    if not check('focus Arrival', scan_for('Arrival'), str(focused())):
        return False
    key('KEYCODE_DPAD_CENTER', pause=4)
    check('detail has Fortsetzen focused', shows(focused(), 'Fortsetzen'), str(focused()))
    if not focus_to('Fortsetzen', 'DOWN', 4):
        return False
    key('KEYCODE_DPAD_CENTER')
    first = wait_report(lambda r: reports(r, 'm1', ('playing',)), 25)
    if not check('m1: plays', first):
        return False
    check('m1: resumes at 19 s or later', first[0]['PositionTicks'] >= 19 * SECOND, str(first[0]['PositionTicks']))
    time.sleep(8)

    after = lambda t: lambda r: [e for e in reports(r, 'm1', ('progress',)) if e['at'] >= t]
    t = int(time.time() * 1000)
    key('KEYCODE_MEDIA_PLAY_PAUSE')
    check('m1: play pause key pauses', wait_report(lambda r: [e for e in after(t)(r) if e['IsPaused']], 6))
    t = int(time.time() * 1000)
    key('KEYCODE_MEDIA_PLAY_PAUSE')
    check('m1: play pause key resumes', wait_report(lambda r: [e for e in after(t)(r) if not e['IsPaused']], 6))

    time.sleep(6)  # controls hide after 4 s
    last = max(reports(report(), 'm1'), key=lambda e: e['at'])
    t = int(time.time() * 1000)
    key('KEYCODE_DPAD_RIGHT')

    def skipped(r):
        for e in after(t)(r):
            expected = last['PositionTicks'] + (e['at'] - last['at']) * 10_000 + 10 * SECOND
            if abs(e['PositionTicks'] - expected) <= 3 * SECOND:
                return e
        return None

    check('m1: DPAD_RIGHT skips 10 s', wait_report(skipped, 8), f"before {last['PositionTicks']}")

    for _ in range(3):
        key('KEYCODE_BACK', pause=1)
        if wait_report(lambda r: reports(r, 'm1', ('stopped',)), 4):
            break
    check('m1: stopped after back', reports(report(), 'm1', ('stopped',)))
    check('detail visible after the player', wait_for('Fortsetzen', 8) or find('Abspielen'))
    return True


def back_home():
    step('back to home')
    key('KEYCODE_BACK', pause=3)
    check('home focuses Arrival again', shows(focused(), 'Arrival'), str(focused()))
    key('KEYCODE_BACK', pause=0.5)
    check('exit hint shown', find('Zum Beenden erneut Zurück drücken'), must=False)  # the hint shows for 2 s only
    time.sleep(1)
    check('app still in front after one back on home', in_front())


if __name__ == '__main__':
    if login():
        home()
        if resume_arrival():
            back_home()
    check('app alive at the end', alive())
    finish()
