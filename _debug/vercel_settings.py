import urllib.request, json, re

env = open(r'C:\Users\263350F\_myProjects\GPRTool\deploy.env').read()
token = re.search(r'VERCEL_TOKEN=(\S+)', env).group(1)
pid   = re.search(r'VERCEL_PROJECT_ID=(\S+)', env).group(1)

req  = urllib.request.Request(
    f'https://api.vercel.com/v9/projects/{pid}',
    headers={'Authorization': f'Bearer {token}'}
)
data = json.loads(urllib.request.urlopen(req).read())
print('name:', data.get('name'))
print('framework:', data.get('framework'))
print('rootDirectory:', data.get('rootDirectory'))
print('outputDirectory:', data.get('outputDirectory'))
print('buildCommand:', data.get('buildCommand'))
print('installCommand:', data.get('installCommand'))
