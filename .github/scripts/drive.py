"""Phone smoke driver: logs in, opens every tab, plays titles and checks what the mock Jellyfin records.

The helpers at the top are shared with drive_tv.py. UI dumps are only taken while no video plays,
because uiautomator often fails to get an idle state during playback; the player state comes from /__report.
"""
import json, re, subprocess, sys, time, urllib.request
import xml.etree.ElementTree as ET

PKG = 'app.burrowcinema'
MOCK = 'http://127.0.0.1:8096'
SECOND = 10_000_000  # Jellyfin ticks
results = []


def sh(*args, timeout=30):
    try:
        return subprocess.run(['adb', 'shell', *args], capture_output=True, text=True, timeout=timeout).stdout
    except subprocess.TimeoutExpired:
        return ''


def key(*names, pause=0.6):
    for name in names:
        sh('input', 'keyevent', name)
        time.sleep(pause)


def nodes():
    # A dump can fail while the screen animates (loading skeletons), so try a few times.
    for _ in range(3):
        sh('rm', '-f', '/sdcard/ui.xml')
        out = sh('uiautomator', 'dump', '/sdcard/ui.xml', timeout=25)
        if 'ERROR' in out:
            print(f'!! dump: {out.strip()[:120]}')
        try:
            found = list(ET.fromstring(sh('cat', '/sdcard/ui.xml')).iter('node'))
        except ET.ParseError:
            found = []
        if found:
            return found
        time.sleep(1)
    return []


def label(node):
    return node.get('text') or node.get('content-desc') or ''


def texts(found=None):
    return [label(n) for n in (nodes() if found is None else found) if label(n)]


def find(text, found=None):
    return [n for n in (nodes() if found is None else found) if text in (n.get('text'), n.get('content-desc'))]


def bounds(node):
    return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))


def tap_at(x, y):
    sh('input', 'tap', str(int(x)), str(int(y)))


def tap(node):
    x1, y1, x2, y2 = bounds(node)
    tap_at((x1 + x2) / 2, (y1 + y2) / 2)


def tap_text(text, last=False):
    found = find(text)
    if not found:
        print(f'!! not found: {text}')
        return False
    tap(found[-1] if last else found[0])
    return True


def wait_for(text, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        if find(text):
            return True
        time.sleep(1)
    return False


def screen_size(found=None):
    found = nodes() if found is None else found
    return bounds(found[0])[2:] if found else (1080, 2400)


def swipe(up=True):
    w, h = screen_size()
    a, b = (h * 0.75, h * 0.3) if up else (h * 0.3, h * 0.75)
    sh('input', 'swipe', str(w // 2), str(int(a)), str(w // 2), str(int(b)), '400')
    time.sleep(1.5)


def landscape_center():
    """Middle of the screen in the landscape player, from the physical size."""
    w, h = map(int, re.findall(r'(\d+)x(\d+)', sh('wm', 'size'))[-1])
    return max(w, h) / 2, min(w, h) / 2


def scroll_top():
    for _ in range(4):
        swipe(up=False)


def diagnose():
    focus = re.findall(r'mCurrentFocus=.*', sh('dumpsys', 'window'))
    print(f'   focus: {focus[:1]}')
    log = subprocess.run(['adb', 'logcat', '-d', '-t', '400'], capture_output=True, text=True).stdout.splitlines()
    for line in [l for l in log if 'ReactNativeJS' in l or 'PictureInPicture' in l or 'ExoPlayer' in l][-12:]:
        print(f'   {line[:200]}')


def find_scrolling(text, swipes=6):
    """Scrolls down until the text is on screen. Returns its node or None."""
    for _ in range(swipes + 1):
        found = find(text)
        if found:
            return found[0]
        swipe(up=True)
    return None


def alive():
    return sh('pidof', PKG).strip() != ''


def keyboard_shown():
    """True or False from the input method dump, None when the dump format is unknown."""
    state = re.findall(r'(?:mInputShown|mIsInputViewShown)=(true|false)', sh('dumpsys', 'input_method'))
    return 'true' in state if state else None


def hide_keyboard(when_unknown=True):
    """Back closes the keyboard; without a keyboard it would leave the screen, so only press it when one is shown."""
    shown = keyboard_shown()
    if shown or (shown is None and when_unknown):
        key('KEYCODE_BACK', pause=1)


def report():
    try:
        with urllib.request.urlopen(f'{MOCK}/__report', timeout=10) as res:
            return json.load(res)
    except OSError:
        return {}


def wait_report(predicate, timeout=20):
    """Polls the mock report until predicate(report) is truthy; returns that value or None."""
    end = time.time() + timeout
    while time.time() < end:
        value = predicate(report())
        if value:
            return value
        time.sleep(1)
    return None


def reports(r, item, lists=('playing', 'progress')):
    return [e for name in lists for e in r.get(name, []) if e.get('ItemId') == item]


def max_position(r, item):
    return max([e.get('PositionTicks') or 0 for e in reports(r, item)], default=0)


def check(name, ok, detail='', must=True):
    results.append((name, bool(ok), must))
    print(f"{'ok  ' if ok else ('FAIL' if must else 'WARN')} {name}{f' ({detail})' if detail else ''}", flush=True)
    if must and not ok:
        diagnose()
    return bool(ok)


def finish():
    failed = [name for name, ok, must in results if must and not ok]
    print(f'== {len(results) - len(failed)} of {len(results)} checks passed', flush=True)
    for name in failed:
        print(f'   failed: {name}')
    sys.exit(1 if failed else 0)


def step(title):
    print(f'\n== {title}, alive: {alive()}', flush=True)


# ---------------------------------------------------------------- phone flow

TABS = ['Bibliothek', 'Suche', 'Auslosung', 'Ordner', 'Einstellungen']


def to_tabs():
    """Back until the tab bar is visible."""
    for _ in range(6):
        if find('Einstellungen'):
            return True
        key('KEYCODE_BACK', pause=2)
    return check('back to the tab bar', find('Einstellungen'))


def show_controls(target):
    """Taps an empty spot of the player until the control with the label is visible. Returns its node."""
    for _ in range(3):
        found = nodes()
        match = find(target, found)
        if match:
            return match[0]
        w, h = screen_size(found)
        tap_at(w * 0.25, h * 0.35)
        time.sleep(1.5)
    return None


def toggle_play(item, want_paused, since):
    """Taps the play button in the middle of the player (the first tap may only show the controls).
    No UI dump here: a playing video never lets uiautomator see an idle screen."""
    match = lambda r: any(e['IsPaused'] == want_paused and e['at'] >= since for e in reports(r, item, ('progress',)))
    x, y = landscape_center()
    for _ in range(2):
        tap_at(x, y)
        if wait_report(match, 5):
            return True
    return False


def pause(item, since):
    """Pauses with the media key, else with the pause button. True once the mock saw IsPaused."""
    key('KEYCODE_MEDIA_PAUSE')
    paused = lambda r: any(e['IsPaused'] and e['at'] >= since for e in reports(r, item, ('progress',)))
    # Phones have no focused view in touch mode, so Android may not hand media keys to the app.
    if check(f'{item}: media key pause reports IsPaused', wait_report(paused, 5), must=False):
        return True
    return check(f'{item}: pause button reports IsPaused', toggle_play(item, True, since))


def close_player(item):
    """Back until the mock got Stopped for the item (an open panel or the controls may take one press each)."""
    for _ in range(4):
        key('KEYCODE_BACK', pause=1)
        if wait_report(lambda r: reports(r, item, ('stopped',)), 5):
            return check(f'{item}: stopped after back', True)
    return check(f'{item}: stopped after back', False)


def play(item, name):
    """Opens the title from the library tab and presses Abspielen. Returns the start time in ms."""
    tap_text('Bibliothek', last=True)
    time.sleep(3)
    scroll_top()
    node = find_scrolling(name)
    if not check(f'{name} found in the library', node is not None):
        return None
    tap(node)
    time.sleep(4)
    since = int(time.time() * 1000)
    if not check(f'{name}: Abspielen', tap_text('Abspielen')):
        return None
    return since


def login_and_tabs():
    for index, value in enumerate(['http://10.0.2.2:8096', 'max', 'secret']):
        fields = [n for n in nodes() if n.get('class') == 'android.widget.EditText']
        tap(fields[index])
        time.sleep(0.5)
        sh('input', 'text', value)
        time.sleep(0.3)
        hide_keyboard()  # so the next field is visible
        time.sleep(1)
    check('login form has Mit Quick Connect anmelden', find('Mit Quick Connect anmelden'), must=False)
    tap_text('Anmelden', last=True)
    time.sleep(10)
    for allow in ['Allow', 'Zulassen']:  # Android asks for notifications right after the login
        if find(allow):
            tap_text(allow)
            time.sleep(2)
    step('after login')
    check('signed in', wait_for('Einstellungen', 30))

    for tab in TABS:
        tap_text(tab, last=True)
        time.sleep(5)
        for allow in ['Allow', 'Zulassen']:  # notification permission dialog
            if find(allow):
                tap_text(allow)
                time.sleep(2)
        step(f'tab {tab}')
        print(texts()[:20])
    check('app alive after all tabs', alive())


def folder_sheets():
    tap_text('Bibliothek', last=True)
    time.sleep(3)
    node = find_scrolling('Dune')
    if not check('Dune found for the folder sheets', node is not None):
        return
    tap(node)
    time.sleep(5)
    step('detail Dune')
    # Bottom sheets: add the open title to a new folder, then open the folder actions.
    tap_text('Zu Ordner hinzufügen')
    time.sleep(3)
    field = [n for n in nodes() if n.get('class') == 'android.widget.EditText']
    if field:
        tap(field[0])
        time.sleep(0.5)
        sh('input', 'text', 'Filmabend')
        sh('input', 'keyevent', '66')  # Enter submits and creates the folder
        time.sleep(3)
    key('KEYCODE_BACK', pause=2)  # close the sheet
    key('KEYCODE_BACK', pause=2)  # back to the library
    tap_text('Ordner', last=True)
    time.sleep(4)
    check('folder Filmabend created', tap_text('Filmabend'))
    time.sleep(4)
    check('folder actions sheet', tap_text('Ordner Aktionen') and wait_for('Umbenennen', 5))
    check('rename sheet', tap_text('Umbenennen') and alive())
    time.sleep(3)
    key('KEYCODE_BACK', pause=2)  # close the sheet
    to_tabs()


def home_rows():
    tap_text('Bibliothek', last=True)
    time.sleep(4)
    scroll_top()  # the tab keeps the scroll position from looking for Dune
    seen = set()
    for _ in range(3):
        seen |= set(texts())
        swipe(up=True)
    for title in ['Weiterschauen', 'Nächste Folgen', 'Zuletzt hinzugefügt: Filme']:
        check(f'home row {title}', title in seen)
    for _ in range(4):
        swipe(up=False)


def direct_play():
    """Dune: direct play, intro skip, pause, subtitles, stop, resume and watched."""
    since = play('m0', 'Dune')
    if since is None:
        return False
    started = wait_report(lambda r: max_position(r, 'm0') >= 5 * SECOND, 30)
    check('m0: plays (position at least 5 s)', started, f"max {max_position(report(), 'm0')}")
    ranged = [s for s in report().get('streamRequests', []) if s['path'] == '/Videos/m0/stream' and s['status'] == 206]
    check('m0: range request answered with 206', ranged)
    if not started:
        close_player('m0')
        return False

    pause('m0', since)
    skip = show_controls('Intro überspringen')
    if check('m0: Intro überspringen visible', skip is not None):
        tap(skip)
        check('m0: skip intro reports position at least 20 s', wait_report(lambda r: max_position(r, 'm0') >= 20 * SECOND, 8))

    panel = show_controls('Untertitel')
    if check('m0: Untertitel panel button', panel is not None):
        tap(panel)
        time.sleep(2)
        check('m0: choose Deutsch', tap_text('Deutsch'))
        check('m0: subtitle file requested', wait_report(lambda r: r.get('subtitleRequests'), 10))

    close_player('m0')
    check('m0: detail shows Fortsetzen', wait_for('Fortsetzen', 8))
    tap_text('Als gesehen markieren')
    check('m0: marked as watched', wait_report(lambda r: 'm0' in r.get('played', []), 8))
    return True


def transcode():
    """Her: transcode only, HLS from the mock, ActiveEncodings deleted after stopping."""
    since = play('m2', 'Her')
    if since is None:
        return
    check('m2: plays as Transcode', wait_report(lambda r: any(e['PlayMethod'] == 'Transcode' for e in reports(r, 'm2', ('playing',))), 25))
    time.sleep(12)
    close_player('m2')
    hls = [s['path'] for s in report().get('streamRequests', []) if s['kind'] == 'hls' and s['path'].startswith('/Videos/m2/')]
    check('m2: m3u8 requested', any(p.endswith('.m3u8') for p in hls))
    check('m2: ts segments requested', any(p.endswith('.ts') for p in hls))
    check('m2: transcode stopped on the server', wait_report(lambda r: r.get('activeEncodingsDeleted', 0) >= 1, 5))
    to_tabs()


def fallback():
    """Sicario: the direct stream is broken, the app renegotiates with EnableDirectPlay false."""
    if play('m4', 'Sicario') is None:
        return
    retried = lambda r: any(p['ItemId'] == 'm4' and p['EnableDirectPlay'] is False for p in r.get('playbackInfo', []))
    check('m4: second PlaybackInfo without direct play', wait_report(retried, 30))
    check('m4: plays after the fallback', wait_report(lambda r: max_position(r, 'm4') >= 5 * SECOND, 30))
    close_player('m4')
    to_tabs()


def up_next():
    """Severance: season page, episode 2, seek to 85 %, Up Next starts episode 3."""
    # Through search: on the library tab the first Severance is the episode card in Nächste Folgen.
    tap_text('Suche', last=True)
    time.sleep(3)
    node = None
    fields = [n for n in nodes() if n.get('class') == 'android.widget.EditText']
    if fields:
        tap(fields[0])
        time.sleep(0.5)
        sh('input', 'text', 'Severance')
        time.sleep(4)
        hide_keyboard()
        time.sleep(1)
        node = next((n for n in find('Severance') if n.get('class') != 'android.widget.EditText'), None)
    if not check('Severance found', node is not None):
        return
    tap(node)
    time.sleep(4)
    if not check('season Staffel 1', find_scrolling('Staffel 1', 3) is not None and tap_text('Staffel 1')):
        return
    time.sleep(4)
    found = texts()
    check('season shows three episodes', all(t in found for t in ['Gute Nachrichten', 'Halbe Loop', 'Im Takt']), str(found[:20]))
    if not tap_text('Halbe Loop'):
        return
    time.sleep(4)
    since = int(time.time() * 1000)
    if not check('e2: Abspielen', tap_text('Abspielen')):
        return
    if not check('e2: plays', wait_report(lambda r: reports(r, 'e2', ('playing',)), 25)):
        return
    pause('e2', since)
    bar = show_controls('Position')
    if check('e2: seek bar Position', bar is not None):
        x1, y1, x2, y2 = bounds(bar)
        tap_at(x1 + (x2 - x1) * 0.85, (y1 + y2) / 2)
        time.sleep(2)
        tap_at(*landscape_center())  # play, the controls stay visible while paused
        check('e2: stopped before the next episode', wait_report(lambda r: reports(r, 'e2', ('stopped',)), 30), must=False)
        check('e3: starts through Up Next', wait_report(lambda r: reports(r, 'e3', ('playing',)), 25))
        close_player('e3')
    else:
        close_player('e2')
    to_tabs()


def settings():
    tap_text('Einstellungen', last=True)
    time.sleep(4)
    check('settings card Wiedergabe', find_scrolling('Wiedergabe', 3) is not None)
    field = find_scrolling('TV Code', 8)
    if not check('settings card TV verbinden', field is not None):
        return
    tap(field)
    time.sleep(0.5)
    sh('input', 'text', '482913')
    time.sleep(0.5)
    hide_keyboard()
    tap_text('Verbinden')
    check('TV code authorized', wait_report(lambda r: '482913' in r.get('authorizedCodes', []), 8))


def audio_fallback():
    """When Dune failed because of the emulator's audio sink, play Drive (no audio) to tell the two apart."""
    log = subprocess.run(['adb', 'logcat', '-d'], capture_output=True, text=True).stdout
    if 'AudioSink' not in log:
        return
    print('== AudioSink errors in the log, trying Drive (no audio)')
    to_tabs()
    if play('m3', 'Drive') is not None:
        ok = wait_report(lambda r: max_position(r, 'm3') >= 5 * SECOND, 30)
        print(f'== Drive without audio plays: {bool(ok)}')
        close_player('m3')


if __name__ == '__main__':
    login_and_tabs()
    folder_sheets()
    home_rows()
    dune_ok = direct_play()
    to_tabs()
    transcode()
    fallback()
    up_next()
    settings()
    if not dune_ok:
        audio_fallback()
    check('app alive at the end', alive())
    finish()
