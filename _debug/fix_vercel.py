import urllib.request, json, re

creds = open(r'C:\Users\263350F\_myProjects\GPRTool\deploy.env').read()
token = re.search(r'VERCEL_TOKEN=(\S+)', creds).group(1)
pid   = re.search(r'VERCEL_PROJECT_ID=(\S+)', creds).group(1)
tid   = re.search(r'VERCEL_TEAM_ID=(\S+)', creds).group(1)

url  = f'https://api.vercel.com/v9/projects/{pid}?teamId={tid}'
body = json.dumps({ 'rootDirectory': None, 'outputDirectory': 'app' }).encode()
req  = urllib.request.Request(url, data=body, method='PATCH',
       headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})

r    = urllib.request.urlopen(req)
data = json.loads(r.read())
print('rootDirectory:', data.get('rootDirectory'))
print('outputDirectory:', data.get('outputDirectory'))
print('Done.')
