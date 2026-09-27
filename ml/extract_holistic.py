"""
Extract MediaPipe Holistic landmarks from SLOVO dataset videos.
Extracts: pose (33 landmarks) + face (10 key landmarks) + both hands (21*2 landmarks)
Total features per frame: 33*3 + 10*3 + 42*3 = 255

Usage: python extract_holistic.py
"""
import os
import cv2
import numpy as np
import json
import pandas as pd
import mediapipe as mp
from multiprocessing import Pool, cpu_count
import time

DATASET_DIR = os.path.expanduser('~/dataset/slovo')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'landmarks_holistic')
SEQUENCE_LENGTH = 60  # 60 frames for better temporal detail
NUM_POSE = 33
NUM_FACE_KEY = 10  # Key face landmarks only (mouth, eyes, eyebrows, nose)
NUM_HAND = 21

# Key face landmark indices (most informative for sign language)
# 0=nose tip, 13=mouth upper, 14=mouth lower, 61=mouth left, 291=mouth right,
# 33=left eye inner, 263=right eye inner, 159=left eyebrow, 386=right eyebrow, 152=chin
FACE_KEY_INDICES = [0, 13, 14, 61, 291, 33, 263, 159, 386, 152]

# Total features: (33 + 10 + 21 + 21) * 3 = 255
FEATURES_PER_FRAME = (NUM_POSE + NUM_FACE_KEY + NUM_HAND * 2) * 3

mp_holistic = mp.solutions.holistic


def extract_from_video(video_path):
    """Extract holistic landmarks from a video."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    frames_data = []
    holistic = mp_holistic.Holistic(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.3,
        min_tracking_confidence=0.3
    )

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        h, w = frame.shape[:2]
        if w > 640:
            scale = 640 / w
            frame = cv2.resize(frame, (640, int(h * scale)))

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = holistic.process(rgb)

        frame_data = np.zeros(FEATURES_PER_FRAME, dtype=np.float32)
        offset = 0

        # 1. Pose landmarks (33 * 3 = 99)
        if results.pose_landmarks:
            for i, lm in enumerate(results.pose_landmarks.landmark):
                frame_data[offset + i*3] = lm.x
                frame_data[offset + i*3 + 1] = lm.y
                frame_data[offset + i*3 + 2] = lm.z
        offset += NUM_POSE * 3

        # 2. Face key landmarks (10 * 3 = 30)
        if results.face_landmarks:
            for i, idx in enumerate(FACE_KEY_INDICES):
                lm = results.face_landmarks.landmark[idx]
                frame_data[offset + i*3] = lm.x
                frame_data[offset + i*3 + 1] = lm.y
                frame_data[offset + i*3 + 2] = lm.z
        offset += NUM_FACE_KEY * 3

        # 3. Left hand (21 * 3 = 63)
        if results.left_hand_landmarks:
            for i, lm in enumerate(results.left_hand_landmarks.landmark):
                frame_data[offset + i*3] = lm.x
                frame_data[offset + i*3 + 1] = lm.y
                frame_data[offset + i*3 + 2] = lm.z
        offset += NUM_HAND * 3

        # 4. Right hand (21 * 3 = 63)
        if results.right_hand_landmarks:
            for i, lm in enumerate(results.right_hand_landmarks.landmark):
                frame_data[offset + i*3] = lm.x
                frame_data[offset + i*3 + 1] = lm.y
                frame_data[offset + i*3 + 2] = lm.z

        frames_data.append(frame_data)

    cap.release()
    holistic.close()

    if len(frames_data) == 0:
        return None

    # Normalize to SEQUENCE_LENGTH frames
    frames = np.array(frames_data)
    if len(frames) >= SEQUENCE_LENGTH:
        indices = np.linspace(0, len(frames) - 1, SEQUENCE_LENGTH, dtype=int)
        frames = frames[indices]
    else:
        pad = np.zeros((SEQUENCE_LENGTH - len(frames), FEATURES_PER_FRAME), dtype=np.float32)
        frames = np.vstack([frames, pad])

    return frames


def process_video(args):
    """Process a single video (for multiprocessing)."""
    video_path, output_path = args
    if os.path.exists(output_path):
        return True
    try:
        landmarks = extract_from_video(video_path)
        if landmarks is not None:
            np.save(output_path, landmarks)
            return True
    except Exception as e:
        pass
    return False


def main():
    ann_path = os.path.join(DATASET_DIR, 'annotations.csv')
    df = pd.read_csv(ann_path, sep='\t')

    # Build label map
    labels = sorted(df['text'].unique())
    label_map = {label: idx for idx, label in enumerate(labels)}

    os.makedirs(os.path.join(OUTPUT_DIR, 'train'), exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, 'test'), exist_ok=True)

    # Save label map
    with open(os.path.join(OUTPUT_DIR, 'label_map.json'), 'w', encoding='utf-8') as f:
        json.dump(label_map, f, ensure_ascii=False, indent=2)

    # Save config
    config = {
        'sequence_length': SEQUENCE_LENGTH,
        'features_per_frame': FEATURES_PER_FRAME,
        'num_pose': NUM_POSE,
        'num_face_key': NUM_FACE_KEY,
        'num_hand': NUM_HAND,
        'face_key_indices': FACE_KEY_INDICES,
        'feature_layout': 'pose(99) + face(30) + left_hand(63) + right_hand(63) = 255'
    }
    with open(os.path.join(OUTPUT_DIR, 'config.json'), 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    total_start = time.time()

    for split in ['train', 'test']:
        is_train = (split == 'train')
        split_df = df[df['train'] == is_train]
        video_dir = os.path.join(DATASET_DIR, split)

        tasks = []
        for _, row in split_df.iterrows():
            vid = row['attachment_id']
            video_path = os.path.join(video_dir, f'{vid}.mp4')
            output_path = os.path.join(OUTPUT_DIR, split, f'{vid}.npy')
            if os.path.exists(video_path):
                tasks.append((video_path, output_path))

        print(f'\n{split}: Processing {len(tasks)} videos...')
        start = time.time()

        workers = max(1, cpu_count() - 1)
        done = 0
        with Pool(workers) as pool:
            for result in pool.imap_unordered(process_video, tasks, chunksize=10):
                done += 1
                if done % 500 == 0:
                    elapsed = time.time() - start
                    speed = done / elapsed
                    remaining = (len(tasks) - done) / speed / 60
                    print(f'  {done}/{len(tasks)} ({done/len(tasks)*100:.1f}%) - {speed:.1f} vid/s - ~{remaining:.0f} min left')

        elapsed = time.time() - start
        existing = len([f for f in os.listdir(os.path.join(OUTPUT_DIR, split)) if f.endswith('.npy')])
        print(f'{split}: {existing}/{len(tasks)} files - {elapsed/60:.1f} min')

    total_elapsed = time.time() - total_start
    print(f'\n✅ Done! Total time: {total_elapsed/60:.1f} min')
    print(f'Output: {OUTPUT_DIR}')
    print(f'Features per frame: {FEATURES_PER_FRAME}')
    print(f'Sequence length: {SEQUENCE_LENGTH}')


if __name__ == '__main__':
    main()
