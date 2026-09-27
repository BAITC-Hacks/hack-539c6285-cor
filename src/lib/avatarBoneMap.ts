// Mapping Mixamo bone names (как пишет record_gesture.py) →
// реальные имена костей в данном аватаре ziza123.blend.
//
// Body bones: двоеточие ":" режется при glTF-экспорте,
// поэтому "mixamorig:Hips" → "mixamorigHips".
// Пальцевые кости в этом риге имеют короткие имена (a, b, c, 1, 2, 3, ...).

export type AxisFlip = [number, number, number];

export interface BoneMapEntry {
  target: string;
  axisFlip?: AxisFlip;
}

export const DEFAULT_AXIS_FLIP: AxisFlip = [1, 1, 1];

const MAP: Record<string, string> = {
  // ——— Правая рука ———
  'mixamorig:RightShoulder': 'j',
  'mixamorig:RightArm': 'i',
  'mixamorig:RightForeArm': 'h',
  'mixamorig:RightHand': 'g',

  'mixamorig:RightHandThumb1': '3',
  'mixamorig:RightHandThumb2': '2',
  'mixamorig:RightHandThumb3': '1',

  'mixamorig:RightHandIndex1': '6',
  'mixamorig:RightHandIndex2': '5',
  'mixamorig:RightHandIndex3': '4',

  'mixamorig:RightHandMiddle1': '9',
  'mixamorig:RightHandMiddle2': '8',
  'mixamorig:RightHandMiddle3': '7',

  'mixamorig:RightHandRing1': 'c',
  'mixamorig:RightHandRing2': 'b',
  'mixamorig:RightHandRing3': 'a',

  'mixamorig:RightHandPinky1': 'f',
  'mixamorig:RightHandPinky2': 'e',
  'mixamorig:RightHandPinky3': 'd',

  // ——— Левая рука ———
  'mixamorig:LeftShoulder': '14',
  'mixamorig:LeftArm': '13',
  'mixamorig:LeftForeArm': '12',
  'mixamorig:LeftHand': 'z',

  'mixamorig:LeftHandThumb1': 'm',
  'mixamorig:LeftHandThumb2': 'l',
  'mixamorig:LeftHandThumb3': 'k',

  'mixamorig:LeftHandIndex1': 'p',
  'mixamorig:LeftHandIndex2': 'o',
  'mixamorig:LeftHandIndex3': 'n',

  'mixamorig:LeftHandMiddle1': 's',
  'mixamorig:LeftHandMiddle2': 'r',
  'mixamorig:LeftHandMiddle3': 'q',

  'mixamorig:LeftHandRing1': 'v',
  'mixamorig:LeftHandRing2': 'u',
  'mixamorig:LeftHandRing3': 't',

  'mixamorig:LeftHandPinky1': 'y',
  'mixamorig:LeftHandPinky2': 'x',
  'mixamorig:LeftHandPinky3': 'w',
};

const AXIS: Record<string, AxisFlip> = {};

export function resolveBone(jsonName: string): BoneMapEntry {
  if (MAP[jsonName]) {
    return { target: MAP[jsonName], axisFlip: AXIS[jsonName] ?? DEFAULT_AXIS_FLIP };
  }
  const sanitized = jsonName.replace(/:/g, '');
  return { target: sanitized, axisFlip: AXIS[jsonName] ?? DEFAULT_AXIS_FLIP };
}
