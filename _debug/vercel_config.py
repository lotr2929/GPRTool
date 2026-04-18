import urllib.request, json, re

creds = open(r'C:\Users\263350F\_myProjects\GPRTool\deploy.env').read()
token = re.search(r'VERCEL_TOKEN=(\S+)', creds).group(1)
pid   = re.search(r'VERCEL_PROJECT_ID=(\S+)', creds).group(1)

url = f'https://api.vercel.com/v9/projects/{pid}'
req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
data = json.loads(urllib.request.urlopen(req).read())

print('Framework:', data.get('framework'))
print('outputDirectory:', data.get('outputDirectory'))
print('rootDirectory:', data.get('rootDirectory'))
print('buildCommand:', data.get('buildCommand'))
print('installCommand:', data.get('installCommand'))
