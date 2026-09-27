"""
Step 1: Extract MediaPipe hand landmarks from SLOVO dataset videos.
Saves normalized landmark sequences as .npy files.

Usage: python extract_landmarks.py
"""
import os
import cv2
import numpy as np
import json
import mediapipe as mp
from multiprocessing import Pool, cpu_count

DATASET_DIR = os.path.expanduser('~/dataset/slovo')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'landmarks')
SEQUENCE_LENGTH = 30
FEATURES_PER_FRAME = 126  # 2 hands * 21 landmarks * 3 coords

mp_hands = mp.solutions.hands


def extract_landmarks_from_video(video_path):
    """Extract hand landmarks from a video, normalize to SEQUENCE_LENGTH frames."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    frames_landmarks = []
    hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2, min_detection_confidence=0.3)

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        h, w = frame.shape[:2]
        if w > 640:
            scale = 640 / w
            frame = cv2.resize(frame, (640, int(h * scale)))

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb)

        frame_data = np.zeros(FEATURES_PER_FRAME, dtype=np.float32)
        if results.multi_hand_landmarks:
            for i, hand_lm in enumerate(results.multi_hand_landmarks[:2]):
                offset = i * 63
                for j, lm in enumerate(hand_lm.landmark):
                    frame_data[offset + j * 3] = lm.x
                    frame_data[offset + j * 3 + 1] = lm.y
                    frame_data[offset + j * 3 + 2] = lm.z

        frames_landmarks.append(frame_data)

    cap.release()
    hands.close()

    if len(frames_landmarks) == 0:
        return None

    # Normalize to SEQUENCE_LENGTH frames
    frames = np.array(frames_landmarks)
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
        landmarks = extract_landmarks_from_video(video_path)
        if landmarks is not None:
            np.save(output_path, landmarks)
            return True
    except Exception:
        pass
    return False


def main():
    import pandas as pd

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
        workers = max(1, cpu_count() - 1)
        with Pool(workers) as pool:
            results = list(pool.imap_unordered(process_video, tasks))

        success = sum(results)
        print(f'{split}: {success}/{len(tasks)} completed')

    print('\nDone!')


if __name__ == '__main__':
    main()
