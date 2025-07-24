
import { BSON } from 'bson';
import Konva from 'konva';
import { useEffect, useState } from 'react';
import { CanvasTexture, Texture, SRGBColorSpace } from 'three';
import brotliPromise from 'brotli-wasm'

export async function textureToPng(texture: Texture): Promise<{ blob: Blob; w: number; h: number }> {
  const img = (texture.image ?? texture.source?.data) as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | { data: Uint8Array; width: number; height: number };

  // --- DataTexture (TypedArray) ---
  if ('data' in img) {
    const { width, height, data } = img;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer), width, height), 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { blob, w: width, h: height };
  }

  // --- HTMLCanvasElement ---
  if (img instanceof HTMLCanvasElement) {
    const { width, height } = img;
    const blob = await new Promise<Blob>((r) => img.toBlob((b) => r(b!), 'image/png')!);
    return { blob, w: width, h: height };
  }

  // --- ImageBitmap ---
  if (img instanceof ImageBitmap) {
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { blob, w: img.width, h: img.height };
  }

  // --- HTMLImageElement ---
  if (img instanceof HTMLImageElement) {
    await img.decode?.().catch(() => undefined);
    const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { blob, w: img.naturalWidth, h: img.naturalHeight };
  }

  throw new Error('Unsupported texture.image type');
}



export function useKonvaTexture(layerRef: React.RefObject<Konva.Layer | null>, event: any): CanvasTexture {

    const [tex] = useState(() => new CanvasTexture(document.createElement('canvas')));

    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;

        // scene 用キャンバスを直接参照
        const canvas: HTMLCanvasElement = layer.getNativeCanvasElement();
        tex.flipY = false;
        tex.image = canvas;
        tex.needsUpdate = true;
        tex.colorSpace = SRGBColorSpace;

        // Konva が何か描いたら GPU 転送を更新
        const update = () => {
            console.log('Konva texture update');
            tex.needsUpdate = true
        };
        layer.on('draw', update);

        return () => {layer.off('draw', update)}
    }, [layerRef, tex, event]);

    return tex;
}

export async function sha256SumBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256SumBuffer(buf: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}


export async function Compress(json: string): Promise<ArrayBuffer> {
    const bsonData = BSON.serialize(JSON.parse(json));

    const brotli = await brotliPromise;
    const compressedData = brotli.compress(bsonData);

    const compressedDataWithHeader = new Uint8Array(compressedData.byteLength + 9);
    // add 9 bytes header
    const header = new Uint8Array([0x46, 0x72, 0x44, 0x54, 0x00, 0x00, 0x00, 0x00, 0x03]);
    compressedDataWithHeader.set(header, 0);
    compressedDataWithHeader.set(new Uint8Array(compressedData), 9);
    return compressedDataWithHeader;
}

