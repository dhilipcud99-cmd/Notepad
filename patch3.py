with open(r'e:\Projects\Notepad\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and remove from Format button through the second rt-sep after +Folder
start = content.find('          <button class="ide-btn" id="projectFormatBtn"')
end = content.find('          <select class="ide-select" id="projectThemeSelect"')

if start == -1:
    print("ERROR: start not found")
elif end == -1:
    print("ERROR: end not found")
else:
    removed = content[start:end]
    print("Removing:", repr(removed[:80]))
    content = content[:start] + content[end:]
    print("OK")

with open(r'e:\Projects\Notepad\index.html', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("Done")
