"""
Convert trained Keras model to TensorFlow.js format.

Usage:
  python convert_to_tfjs.py [--model best_model.keras] [--output ../public/model]

Handles Keras 3 compatibility:
  - Tries SavedModel → graph_model (most reliable)
  - Falls back to keras → layers_model
  - Verifies unique weight names for browser safety
"""
import os
import sys
import json
import shutil
import argparse
import subprocess
import tempfile


def convert(model_path: str, output_dir: str):
    import tensorflow as tf

    print(f'TensorFlow: {tf.__version__}')
    print(f'Input:  {model_path}')
    print(f'Output: {output_dir}')

    # Load model
    model = tf.keras.models.load_model(model_path)
    model.summary()

    os.makedirs(output_dir, exist_ok=True)

    # Strategy 1: SavedModel → graph_model (best for Keras 3)
    success = False
    with tempfile.TemporaryDirectory() as tmpdir:
        saved_model_dir = os.path.join(tmpdir, 'saved_model')
        print('\n[1/2] Exporting SavedModel...')
        model.export(saved_model_dir)

        print('[2/2] Converting to TF.js graph_model...')
        result = subprocess.run([
            sys.executable, '-m', 'tensorflowjs.converters.converter',
            '--input_format=tf_saved_model',
            '--output_format=tfjs_graph_model',
            '--signature_name=serving_default',
            '--saved_model_tags=serve',
            saved_model_dir,
            output_dir
        ], capture_output=True, text=True)

        if result.returncode == 0:
            success = True
            print('✅ Converted as graph_model')
        else:
            print(f'⚠️ graph_model failed: {result.stderr[:200]}')

    # Strategy 2: Fallback → layers_model
    if not success:
        print('\n[Fallback] Converting as layers_model...')
        result = subprocess.run([
            sys.executable, '-m', 'tensorflowjs.converters.converter',
            '--input_format=keras',
            '--output_format=tfjs_layers_model',
            model_path,
            output_dir
        ], capture_output=True, text=True)

        if result.returncode == 0:
            success = True
            print('✅ Converted as layers_model')
        else:
            print(f'❌ Conversion failed: {result.stderr}')
            sys.exit(1)

    # Verify model.json
    model_json_path = os.path.join(output_dir, 'model.json')
    with open(model_json_path, 'r') as f:
        mj = json.load(f)

    weights = mj.get('weightsManifest', [{}])[0].get('weights', [])
    w_names = [w['name'] for w in weights]
    dupes = set(n for n in w_names if w_names.count(n) > 1)

    if dupes:
        print(f'\n⚠️ Duplicate weight names found: {dupes}')
        print('This may cause issues in the browser.')
    else:
        print(f'\n✅ All {len(w_names)} weight names unique — browser safe!')

    # Copy label_map if it exists nearby
    label_map_src = os.path.join(os.path.dirname(model_path), 'label_map.json')
    if not os.path.exists(label_map_src):
        label_map_src = os.path.join(os.path.dirname(__file__), 'landmarks', 'label_map.json')

    if os.path.exists(label_map_src):
        shutil.copy(label_map_src, os.path.join(output_dir, 'label_map.json'))
        print(f'✅ Copied label_map.json')

    # Print files
    total = 0
    print(f'\n📦 Output files:')
    for f in sorted(os.listdir(output_dir)):
        sz = os.path.getsize(os.path.join(output_dir, f))
        total += sz
        print(f'  {f} ({sz/1024:.1f} KB)')
    print(f'\n  Total: {total/1024:.0f} KB ({total/1024/1024:.1f} MB)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Convert Keras model to TF.js')
    parser.add_argument('--model', default='output/best_model.keras', help='Path to .keras model')
    parser.add_argument('--output', default='../public/model', help='Output directory for TF.js files')
    args = parser.parse_args()

    convert(args.model, args.output)
