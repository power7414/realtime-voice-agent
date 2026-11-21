/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type GetAudioContextOptions = AudioContextOptions & {
  id?: string;
};

const map: Map<string, AudioContext> = new Map();

export const audioContext: (
  options?: GetAudioContextOptions
) => Promise<AudioContext> = (() => {
  const didInteract = new Promise((res) => {
    window.addEventListener("pointerdown", res, { once: true });
    window.addEventListener("keydown", res, { once: true });
  });

  return async (options?: GetAudioContextOptions) => {
    // 🟢 1. 優先檢查快取：若已存在快取的 AudioContext 且未關閉，立即回傳
    if (options?.id && map.has(options.id)) {
      const existingCtx = map.get(options.id);
      if (existingCtx && existingCtx.state !== 'closed') {
        if (existingCtx.state === 'suspended') {
          existingCtx.resume().catch(() => {});
        }
        return existingCtx;
      }
    }

    // 🟢 2. 只有在無快取、需要建立新 AudioContext 時，才嘗試自動解鎖
    try {
      const a = new Audio();
      a.src =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      await a.play();
    } catch (e) {
      await didInteract;
    }

    const ctx = new AudioContext(options);
    if (options?.id) {
      map.set(options.id, ctx);
    }
    return ctx;
  };
})();

