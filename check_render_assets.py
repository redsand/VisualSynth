from pathlib import Path
text = Path('src/renderer/index.ts').read_text()
print('renderAssets' in text)
print(text.count('const renderAssets'))
