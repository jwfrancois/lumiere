import re

with open('/home/z/my-project/src/components/library-views.tsx', 'r') as f:
    content = f.read()

# Fix broken enrichmentKey={} — need to use template literals with backticks
# The pattern is enrichmentKey={} which should be enrichmentKey={`album:${a.id}`} or enrichmentKey={`podcast:${p.id}`}

lines = content.split('\n')
fixed_lines = []

for i, line in enumerate(lines):
    if 'enrichmentKey={}' in line:
        # Look at surrounding context to determine album vs podcast
        context = '\n'.join(lines[max(0,i-5):i+5])
        if 'kind="album"' in context:
            fixed_lines.append(line.replace('enrichmentKey={}', 'enrichmentKey={`album:${a.id}`}'))
        elif 'kind="podcast"' in context:
            fixed_lines.append(line.replace('enrichmentKey={}', 'enrichmentKey={`podcast:${p.id}`}'))
        else:
            fixed_lines.append(line)
    else:
        fixed_lines.append(line)

with open('/home/z/my-project/src/components/library-views.tsx', 'w') as f:
    f.write('\n'.join(fixed_lines))

# Verify
with open('/home/z/my-project/src/components/library-views.tsx', 'r') as f:
    content = f.read()

remaining = content.count('enrichmentKey={}')
print(f'Remaining broken: {remaining}')
