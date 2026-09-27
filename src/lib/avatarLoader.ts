import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface LoadedAvatar {
  root: THREE.Object3D;
  bones: Map<string, THREE.Bone>;
}

/**
 * Доступные аватары. Скелет у обоих ОДИН И ТОТ ЖЕ (52 кости, те же имена):
 * Ева сделана пересадкой скелета Адама в новое тело, поэтому вся библиотека
 * жестов, решатель зеркала и студия записи работают на обоих без развилок.
 * У Адама нет лицевых морфов — модуль лица на нём просто молчит.
 */
export type AvatarId = 'adam' | 'eva' | 'elnar';
export const AVATARS: Record<AvatarId, { url: string }> = {
  adam: { url: '/avatar.glb' },
  eva: { url: '/avatar_eva.glb' },
  // Елнар: тело пользователя (MakeHuman) с пересаженным скелетом Адама (2026-09-21)
  elnar: { url: '/avatar_elnar.glb' },
};

const AVATAR_STORAGE_KEY = 'qyran.avatar';

export function getSavedAvatarId(): AvatarId {
  try {
    const v = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (v === 'adam' || v === 'eva' || v === 'elnar') return v;
  } catch {
    /* приватный режим — молча дефолт */
  }
  // Елнар — основной аватар: новые проверенные жесты строятся под его риг
  return 'elnar';
}

export function saveAvatarId(id: AvatarId) {
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export async function loadAvatar(url: string): Promise<LoadedAvatar> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;

  // GLB ships the Armature rotated π/2 around X (Z-up→Y-up) and scaled 0.01
  // (cm bones → m world). Both transforms are load-bearing — leave Armature
  // intact and instead rely on the avatar reaching ~1.8 m world height.

  const bones = new Map<string, THREE.Bone>();
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      bones.set(obj.name, obj as THREE.Bone);
    }
  });

  root.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton) {
      for (const b of sm.skeleton.bones) {
        if (!bones.has(b.name)) bones.set(b.name, b);
      }
    }
  });

  applyNaturalStance(bones);

  // Ensure world matrices are current — bone box computation downstream
  // depends on matrixWorld of skinned meshes, which is only refreshed by the
  // renderer (not yet on first frame).
  root.updateMatrixWorld(true);

  return { root, bones };
}

/**
 * БАЗА ЖЕСТОВ: поворот плеча из T-позы, относительно которого заданы дельты
 * во ВСЕХ анимациях — и в 966 клипах из SLOVO, и в процедурном словаре.
 *
 * Менять нельзя: плеер кладёт кадр как `rest + дельта` (gesturePlayer.update),
 * поэтому сдвиг этой константы сдвинет каждый жест в библиотеке.
 */
export const STANCE_ARM_X = 1.25;

/**
 * ПОЗА ПОКОЯ ДЛЯ ПОКАЗА: как аватар стоит, когда ничего не играет.
 *
 * Измерено (`node scripts/check-stance.mjs`) на настоящем скелете из GLB:
 *
 *   угол   отклонение руки от вертикали   зазор запястий (ширин плеч)
 *   1.25            15.6°                        1.97   <- было
 *   1.45             4.2°                        1.25   <- у человека 1.1–1.3
 *   1.52             0.6°                        1.00
 *
 * При 1.25 руки развешены почти вдвое шире человеческих: на экране это читается
 * как раздутые плечи и слипшийся с корпусом рукав. 1.45 даёт человеческий
 * разлёт при почти вертикальной руке.
 *
 * Специально ОТДЕЛЕНО от STANCE_ARM_X: смена показа не должна трогать базу,
 * относительно которой посчитаны все анимации.
 */
export const IDLE_ARM_X = 1.45;

export function applyNaturalStance(bones: Map<string, THREE.Bone>) {
  const rArm = bones.get('i');
  if (rArm) rArm.rotation.x += STANCE_ARM_X;
  const lArm = bones.get('13');
  if (lArm) lArm.rotation.x += STANCE_ARM_X;
}
