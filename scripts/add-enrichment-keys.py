import re

with open('/home/z/my-project/src/components/library-views.tsx', 'r') as f:
    content = f.read()

# Add enrichmentKey to SpotifyCard components for albums
# We look for lines with kind="album" that don't already have enrichmentKey
lines = content.split('\n')
new_lines = []
in_spotify_card = False
current_var = None

for i, line in enumerate(lines):
    new_lines.append(line)
    
    # Detect SpotifyCard opening
    if '<SpotifyCard' in line:
        in_spotify_card = True
    
    # Detect the variable used (a. or p.)
    if in_spotify_card and 'title={a.' in line:
        current_var = 'a'
    if in_spotify_card and 'title={p.' in line:
        current_var = 'p'
    
    # Add enrichmentKey before onClick if missing
    if in_spotify_card and 'onClick' in line and 'enrichmentKey' not in '\n'.join(new_lines[-5:]):
        if 'kind="album"' in '\n'.join(new_lines[-5:]):
            indent = len(line) - len(line.lstrip())
            new_lines.insert(-1, ' ' * indent + f'enrichmentKey={{`album:${{{current_var}.id}}`}}')
        elif 'kind="podcast"' in '\n'.join(new_lines[-5:]):
            indent = len(line) - len(line.lstrip())
            new_lines.insert(-1, ' ' * indent + f'enrichmentKey={{`podcast:${{{current_var}.id}}`}}')
    
    if in_spotify_card and '/>' in line:
        in_spotify_card = False
        current_var = None

with open('/home/z/my-project/src/components/library-views.tsx', 'w') as f:
    f.write('\n'.join(new_lines))

print(f'Processed {len(lines)} lines')
