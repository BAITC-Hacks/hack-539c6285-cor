"""
Step 2: Train LSTM model on extracted landmarks.

Usage: python train_model.py
"""
import os
import numpy as np
import json
from sklearn.model_selection import train_test_split

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

LANDMARKS_DIR = os.path.join(os.path.dirname(__file__), 'landmarks')
SEQUENCE_LENGTH = 30
FEATURES_PER_FRAME = 126


def load_data(split):
    import pandas as pd

    ann_path = os.path.expanduser('~/dataset/slovo/annotations.csv')
    df = pd.read_csv(ann_path, sep='\t')
    id_to_label = dict(zip(df['attachment_id'], df['text']))

    with open(os.path.join(LANDMARKS_DIR, 'label_map.json'), 'r', encoding='utf-8') as f:
        label_to_idx = json.load(f)

    split_dir = os.path.join(LANDMARKS_DIR, split)
    files = [f for f in os.listdir(split_dir) if f.endswith('.npy')]
    print(f'Loading {len(files)} {split} samples...')

    X, y = [], []
    for f in files:
        vid_id = f.replace('.npy', '')
        if vid_id not in id_to_label:
            continue
        label = id_to_label[vid_id]
        if label not in label_to_idx:
            continue
        data = np.load(os.path.join(split_dir, f))
        if data.shape != (SEQUENCE_LENGTH, FEATURES_PER_FRAME):
            continue
        X.append(data)
        y.append(label_to_idx[label])

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)
    print(f'  Loaded: X={X.shape}, y={y.shape}')
    return X, y


def build_model(num_classes):
    model = keras.Sequential([
        layers.Input(shape=(SEQUENCE_LENGTH, FEATURES_PER_FRAME)),
        layers.BatchNormalization(),
        layers.Bidirectional(layers.LSTM(256, return_sequences=True, dropout=0.3)),
        layers.BatchNormalization(),
        layers.Bidirectional(layers.LSTM(128, return_sequences=True, dropout=0.3)),
        layers.BatchNormalization(),
        layers.Bidirectional(layers.LSTM(64, dropout=0.3)),
        layers.BatchNormalization(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.4),
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation='softmax')
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model


def main():
    print('=' * 60)
    print('SLOVO - LSTM Model Training')
    print('=' * 60)

    gpus = tf.config.list_physical_devices('GPU')
    print(f'\nGPUs available: {len(gpus)}')

    X_train_full, y_train_full = load_data('train')
    X_test, y_test = load_data('test')

    with open(os.path.join(LANDMARKS_DIR, 'label_map.json'), 'r') as f:
        label_map = json.load(f)
    num_classes = len(label_map)

    X_train, X_val, y_train, y_val = train_test_split(
        X_train_full, y_train_full, test_size=0.15, random_state=42, stratify=y_train_full
    )

    print(f'\nClasses: {num_classes}')
    print(f'Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}')

    model = build_model(num_classes)
    model.summary()

    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    os.makedirs(output_dir, exist_ok=True)

    callbacks = [
        keras.callbacks.ModelCheckpoint(
            os.path.join(output_dir, 'best_model.keras'),
            monitor='val_accuracy', save_best_only=True, verbose=1
        ),
        keras.callbacks.EarlyStopping(
            monitor='val_accuracy', patience=10, restore_best_weights=True, verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss', factor=0.5, patience=5, min_lr=1e-6, verbose=1
        ),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=50, batch_size=64,
        callbacks=callbacks, verbose=1
    )

    test_loss, test_acc = model.evaluate(X_test, y_test, verbose=1)
    print(f'\nTest Accuracy: {test_acc * 100:.2f}%')

    model.save(os.path.join(output_dir, 'final_model.keras'))

    config = {
        'sequence_length': SEQUENCE_LENGTH,
        'features_per_frame': FEATURES_PER_FRAME,
        'num_classes': num_classes,
        'test_accuracy': float(test_acc),
    }
    with open(os.path.join(output_dir, 'model_config.json'), 'w') as f:
        json.dump(config, f, indent=2)

    with open(os.path.join(output_dir, 'training_history.json'), 'w') as f:
        json.dump({
            'accuracy': [float(x) for x in history.history['accuracy']],
            'val_accuracy': [float(x) for x in history.history['val_accuracy']],
            'loss': [float(x) for x in history.history['loss']],
            'val_loss': [float(x) for x in history.history['val_loss']],
        }, f, indent=2)

    print(f'\nAll saved to {output_dir}')


if __name__ == '__main__':
    main()
