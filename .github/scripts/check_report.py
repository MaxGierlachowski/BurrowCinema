"""Final checks on the mock Jellyfin report after a driver run: python3 check_report.py <phone|tv> <report.json>."""
import json, sys
from collections import Counter

SECOND = 10_000_000
mode, path = sys.argv[1], sys.argv[2]
r = json.load(open(path))
failed = []


def check(name, ok, detail=''):
    print(f"{'ok  ' if ok else 'FAIL'} {name}{f' ({detail})' if detail else ''}")
    if not ok:
        failed.append(name)


def of(item, *lists):
    return [e for name in lists for e in r.get(name, []) if e.get('ItemId') == item]


def max_position(item):
    return max([e.get('PositionTicks') or 0 for e in of(item, 'playing', 'progress')], default=0)


# Every play session reports Playing and Stopped exactly once.
playing = Counter(e['PlaySessionId'] for e in r['playing'])
stopped = Counter(e['PlaySessionId'] for e in r['stopped'])
check('one Playing per session', all(n == 1 for n in playing.values()), str(dict(playing)))
check('at most one Stopped per session', all(n == 1 for n in stopped.values()), str(dict(stopped)))

if mode == 'phone':
    sessions = [e['PlaySessionId'] for e in of('m0', 'playing')]
    check('m0 plays', sessions)
    check('m0 position at least 5 s', max_position('m0') >= 5 * SECOND, str(max_position('m0')))
    check('m0 range request with 206', any(s['path'] == '/Videos/m0/stream' and s['status'] == 206 for s in r['streamRequests']))
    check('m0 at least two progress reports', len(of('m0', 'progress')) >= 2)
    check('m0 paused report', any(e['IsPaused'] for e in of('m0', 'progress')))
    check('m0 intro skipped (position at least 20 s)', max_position('m0') >= 20 * SECOND)
    check('subtitle file requested', r['subtitleRequests'])
    check('m0 stopped', of('m0', 'stopped'))
    check('m0 marked as watched', 'm0' in r['played'])
    check('m2 plays as Transcode', any(e['PlayMethod'] == 'Transcode' for e in of('m2', 'playing')))
    hls = [s['path'] for s in r['streamRequests'] if s['kind'] == 'hls']
    check('HLS playlist and segments requested', any(p.endswith('.m3u8') for p in hls) and any(p.endswith('.ts') for p in hls))
    check('ActiveEncodings deleted', r['activeEncodingsDeleted'] >= 1)
    check('m4 renegotiated without direct play', any(p['ItemId'] == 'm4' and p['EnableDirectPlay'] is False for p in r['playbackInfo']))
    check('m4 plays after the fallback', max_position('m4') >= 5 * SECOND)
    check('e3 started by Up Next', of('e3', 'playing'))
    check('TV code authorized', '482913' in r['authorizedCodes'])
else:
    check('Quick Connect login', r['quickConnectLogins'] >= 1)
    first = of('m1', 'playing')
    check('m1 resumes at 19 s or later', first and first[0]['PositionTicks'] >= 19 * SECOND, str(first[:1]))
    paused = [e['IsPaused'] for e in of('m1', 'progress')]
    check('m1 paused and resumed', True in paused and False in paused[paused.index(True):])
    check('m1 stopped', of('m1', 'stopped'))

print(f'== report: {"all checks passed" if not failed else f"{len(failed)} failed"}')
sys.exit(1 if failed else 0)
