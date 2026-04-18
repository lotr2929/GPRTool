import urllib.request, json, re

creds = open(r'C:\Users\263350F\_myProjects\GPRTool\deploy.env').read()
token = re.search(r'VERCEL_TOKEN=(\S+)', creds).group(1)
pid   = re.search(r'VERCEL_PROJECT_ID=(\S+)', creds).group(1)
tid   = re.search(r'VERCEL_TEAM_ID=(\S+)', creds).group(1)

# The current value has "GOOGLE_MAPS_API_KEY=ACTUALKEY" — extract just the key
# We know the prefix format from the maps-key response
current_value = 'GOOGLE_MAPS_API_KEY=AIzaSyC5hOoEGh2NwWFFBNZBog33eW9F7tIkGjQ'
corrected = current_value.split('=', 1)[1] if '=' in current_value else current_value

env_id = 'qJE6xGfzYDFm5M9R'
url    = f'https://api.vercel.com/v9/projects/{pid}/env/{env_id}?teamId={tid}'
body   = json.dumps({'value': corrected, 'type': 'encrypted'}).encode()
req    = urllib.request.Request(url, data=body, method='PATCH',
         headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})

r    = urllib.request.urlopen(req)
data = json.loads(r.read())
print('Updated key:', data.get('key'))
print('Done — redeploy needed to pick up new value.')
