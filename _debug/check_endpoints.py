import urllib.request, json

for endpoint in ['/api/geocode?address=Perth', '/api/maps-key']:
    url = 'https://gprtool.vercel.app' + endpoint
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        resp = urllib.request.urlopen(req)
        print(f'{endpoint}: {resp.status} OK - {resp.read().decode()[:100]}')
    except urllib.error.HTTPError as e:
        print(f'{endpoint}: {e.code} {e.reason} - {e.read().decode()[:100]}')
