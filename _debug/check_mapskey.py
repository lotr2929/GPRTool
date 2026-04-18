import urllib.request, json

url = 'https://gprtool.vercel.app/api/maps-key'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    resp = urllib.request.urlopen(req)
    print('Status:', resp.status)
    print('Body:', resp.read().decode('utf-8')[:200])
except urllib.error.HTTPError as e:
    print('HTTP Error:', e.code, e.reason)
    print('Body:', e.read().decode('utf-8')[:300])
except Exception as e:
    print('Error:', e)
