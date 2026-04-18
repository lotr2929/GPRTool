import urllib.request, json

token = open(r'C:\Users\263350F\_myProjects\GPRTool\deploy.env').read()
import re
t = re.search(r'VERCEL_TOKEN=(\S+)', token).group(1)
pid = 'prj_oioZB5jSKFHb99IZcSxZutIcjufi'

url = f'https://api.vercel.com/v9/projects/{pid}'
req = urllib.request.Request(url, headers={'Authorization': f'Bearer {t}'})
data = json.loads(urllib.request.urlopen(req).read())
print('Framework:', data.get('framework'))
print('Root dir:', data.get('rootDirectory'))
print('Build command:', data.get('buildCommand'))
print('Output dir:', data.get('outputDirectory'))
