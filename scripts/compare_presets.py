#!/usr/bin/env python3
"""Compare original .milk files with imported preset JSONs."""
import json, os, sys

def extract_milk_section(filepath, prefix):
    """Extract shader body from a .milk file."""
    lines = []
    try:
        with open(filepath) as f:
            content = f.read()
        for line in content.split('\n'):
            if line.startswith(prefix + '_'):
                idx = line.index('=')
                val = line[idx+1:].strip()
                if val.startswith('`'):
                    val = val[1:]
                lines.append(val)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return lines

def find_preset_json(preset_num):
    """Find the imported preset JSON for a given number."""
    presets_dir = 'assets/presets'
    prefix = f'preset-{preset_num}'
    for f in os.listdir(presets_dir):
        if f.startswith(prefix) and f.endswith('.json') and 'milkwave' in f:
            with open(os.path.join(presets_dir, f)) as fh:
                return json.load(fh), f
    return None, None

def find_milk_file(preset_num, milk_dir='Milkwave/Visualizer/resources/presets'):
    """Find the original .milk file."""
    for root, dirs, files in os.walk(milk_dir):
        for f in files:
            if f.startswith('!!!aaa') or f.endswith('.milk'):
                full = os.path.join(root, f)
                # Match by trying to find files that contain the preset content
                pass
    
    # Use metadata from the preset to find the original
    preset_data, preset_name = find_preset_json(preset_num)
    if preset_data:
        source = preset_data.get('metadata', {}).get('source', '')
        if source:
            # Search for the file
            for root, dirs, files in os.walk(milk_dir):
                for f in files:
                    if source.replace('.milk', '') in f or f.replace('.milk', '') in source:
                        return os.path.join(root, f)
    return None

# Test with preset 1010
print("=== Preset 1010 ===")
preset_data, preset_name = find_preset_json(1010)
if not preset_data:
    print("Preset not found")
    sys.exit(1)

print(f"Loaded preset: {preset_name}")
source = preset_data.get('metadata', {}).get('source', '')
print(f"Original source: {source}")

# Find original milk file
milk_path = None
milk_dir = 'Milkwave/Visualizer/resources/presets'
for root, dirs, files in os.walk(milk_dir):
    for f in files:
        if source.replace('.milk', '') in f:
            milk_path = os.path.join(root, f)
            break
    if milk_path:
        break

if milk_path:
    print(f"Found original: {milk_path}")
    # Extract comp shader body
    comp_orig = extract_milk_section(milk_path, 'comp')
    print(f"\nOriginal comp has {len(comp_orig)} lines:")
    for i, l in enumerate(comp_orig):
        if i < 10 or i >= len(comp_orig) - 5:
            print(f"  {i+1}: {l}")
    
    # Get imported comp shader
    sd = preset_data.get('_shaderData', {}) or preset_data.get('scenes', [{}])[0].get('_shaderData', {})
    comp_imported = sd.get('comp', '')
    
    # Show the end of the imported comp shader
    print(f"\nImported comp has {len(comp_imported)} chars:")
    lines = comp_imported.split('\n')
    # Show main body
    for i, l in enumerate(lines):
        if i >= len(lines) - 20:
            print(f"  {i+1}: {l}")
else:
    print("Original milk file not found")
