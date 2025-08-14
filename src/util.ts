import JSZip from 'jszip'
import { BSON } from 'bson'
import { Texture } from 'three'
import brotliPromise from 'brotli-wasm'
import type { AvatarManifest } from './types'

export const handlePublish = async (manifest: Partial<AvatarManifest>, textures: Record<string, Texture>) => {
    const endpoint = 'https://paper-avatar-creator.pages.dev/api/upload'

    const entries = await Promise.all(
        Object.entries(textures).map(async ([key, tex]) => {
            if (!tex) return null
            const { blob } = await textureToPng(tex) // ← 既存ユーティリティ
            return { key, blob }
        })
    )

    const form = new FormData()

    form.append('manifest', new Blob([JSON.stringify(manifest)], { type: 'application/json' }), 'manifest.json')

    for (const e of entries) {
        if (!e) continue
        form.append('textures', e.blob, `${e.key}.png`)
    }

    const res = await fetch(endpoint, {
        method: 'POST',
        body: form
    })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Upload failed: ${res.status} ${res.statusText} ${text}`)
    }

    return res.json().then((data) => {
        if (data.error) {
            throw new Error(`Upload failed: ${data.error}`)
        }
        return data
    })
}

export const handleExport = async (textures: Record<string, Texture>) => {
    const zip = new JSZip()
    for (const key in textures) {
        const texture = textures[key]
        if (!texture) continue

        const { blob } = await textureToPng(texture)
        zip.file(`${key}.png`, blob)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'avatar-textures.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

export const handleResoniteExport = async (textures: Record<string, Texture>) => {
    const assets: Array<any> = []

    const zip = new JSZip()

    for (const key in textures) {
        const texture = textures[key]
        if (!texture) continue

        const { blob } = await textureToPng(texture)
        const hash = await sha256SumBlob(blob)

        zip.file(`Assets/${hash}`, blob)
        assets.push({
            part: key,
            hash: hash,
            bytes: blob.size
        })
    }

    let slots = await fetch('/package/slots.json').then((res) => res.text())
    for (const elem of assets) {
        slots = slots.replace(`[::${elem.part}::]`, elem.hash)
    }
    const slotsBin = await Compress(slots)
    const slotsHash = await sha256SumBuffer(slotsBin)

    zip.file(`Assets/${slotsHash}`, slotsBin)

    const catalog = {
        id: 'R-Main',
        ownerId: '4cyqxejyao5zsogdkyq3oxz4b69yqph1shibhng76u1acyibhksy',
        assetUri: 'packdb:///' + slotsHash,
        version: {
            globalVersion: 0,
            localVersion: 0,
            lastModifyingUserId: null,
            lastModifyingMachineId: null
        },
        name: 'Avatar',
        description: null,
        recordType: 'object',
        ownerName: null,
        tags: null,
        path: null,
        thumbnailUri: null,
        lastModificationTime: '2025-07-23T06:29:57.8443856Z',
        creationTime: '2025-07-23T06:29:57.8443856Z',
        firstPublishTime: null,
        isDeleted: false,
        isPublic: false,
        isForPatrons: false,
        isListed: false,
        isReadOnly: false,
        visits: 0,
        rating: 0,
        randomOrder: 0,
        submissions: null,
        assetManifest: [
            {
                hash: '41ccec83c150c98d061ad6245e0aa866b08ba2237f0087f6e21a0d3deb2cec19',
                bytes: 117
            },
            {
                hash: 'aedca4d3da09eaaa3ef2621025e3fd713019395ec4f0c0ea1d09af5146e8f787',
                bytes: 126710
            },
            ...assets.map((asset) => ({
                hash: asset.hash,
                bytes: asset.bytes
            }))
        ],
        migrationMetadata: null
    }

    const catalogStr = JSON.stringify(catalog)
    zip.file('R-Main.record', catalogStr)

    await fetch('/package/41ccec83c150c98d061ad6245e0aa866b08ba2237f0087f6e21a0d3deb2cec19')
        .then((res) => res.blob())
        .then((blob) => zip.file('Assets/41ccec83c150c98d061ad6245e0aa866b08ba2237f0087f6e21a0d3deb2cec19', blob))

    await fetch('/package/aedca4d3da09eaaa3ef2621025e3fd713019395ec4f0c0ea1d09af5146e8f787')
        .then((res) => res.blob())
        .then((blob) => zip.file('Assets/aedca4d3da09eaaa3ef2621025e3fd713019395ec4f0c0ea1d09af5146e8f787', blob))

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'avatar.resonitepackage'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

async function sha256SumBlob(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buf)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256SumBuffer(buf: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buf)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function Compress(json: string): Promise<ArrayBuffer> {
    const bsonData = BSON.serialize(JSON.parse(json))

    const brotli = await brotliPromise
    const compressedData = brotli.compress(bsonData)

    const compressedDataWithHeader = new Uint8Array(compressedData.byteLength + 9)
    // add 9 bytes header
    const header = new Uint8Array([0x46, 0x72, 0x44, 0x54, 0x00, 0x00, 0x00, 0x00, 0x03])
    compressedDataWithHeader.set(header, 0)
    compressedDataWithHeader.set(new Uint8Array(compressedData), 9)
    return compressedDataWithHeader
}

async function textureToPng(texture: Texture): Promise<{ blob: Blob; w: number; h: number }> {
    const img = (texture.image ?? texture.source?.data) as
        | HTMLImageElement
        | HTMLCanvasElement
        | ImageBitmap
        | { data: Uint8Array; width: number; height: number }

    // --- DataTexture (TypedArray) ---
    if ('data' in img) {
        const { width, height, data } = img
        const canvas = new OffscreenCanvas(width, height)
        const ctx = canvas.getContext('2d')!
        ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer), width, height), 0, 0)
        const blob = await canvas.convertToBlob({ type: 'image/png' })
        return { blob, w: width, h: height }
    }

    // --- HTMLCanvasElement ---
    if (img instanceof HTMLCanvasElement) {
        const { width, height } = img
        const blob = await new Promise<Blob>((r) => img.toBlob((b) => r(b!), 'image/png')!)
        return { blob, w: width, h: height }
    }

    // --- ImageBitmap ---
    if (img instanceof ImageBitmap) {
        const canvas = new OffscreenCanvas(img.width, img.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const blob = await canvas.convertToBlob({ type: 'image/png' })
        return { blob, w: img.width, h: img.height }
    }

    // --- HTMLImageElement ---
    if (img instanceof HTMLImageElement) {
        await img.decode?.().catch(() => undefined)
        const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const blob = await canvas.convertToBlob({ type: 'image/png' })
        return { blob, w: img.naturalWidth, h: img.naturalHeight }
    }

    throw new Error('Unsupported texture.image type')
}
