import JSZip from 'jszip'
import { BSON } from 'bson'
import {
    AdditiveAnimationBlendMode,
    AnimationClip,
    Euler,
    Quaternion,
    QuaternionKeyframeTrack,
    Texture,
    VectorKeyframeTrack
} from 'three'
import brotliPromise from 'brotli-wasm'
import type { AvatarManifest, AvatarParams } from './types'

export const handlePublish = async (
    thumbnail: Blob,
    manifest: Partial<AvatarManifest>,
    textures: Record<string, Texture>
) => {
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
    form.append('thumbnail', thumbnail, 'thumbnail.png')

    for (const e of entries) {
        if (!e) continue
        form.append(e.key, e.blob, `${e.key}.png`)
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

export const handleExport = async (manifest: Partial<AvatarManifest>, textures: Record<string, Texture>) => {
    const zip = new JSZip()
    for (const key in textures) {
        const texture = textures[key]
        if (!texture) continue

        const { blob } = await textureToPng(texture)
        zip.file(`${key}.png`, blob)
    }

    const manifestStr = JSON.stringify(manifest, null, 2)
    zip.file('manifest.json', manifestStr)

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

export const handleResoniteExport = async (manifest: Partial<AvatarManifest>, textures: Record<string, Texture>) => {
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

    const params = manifest.params!

    const baseHeadSize = 0.6
    const headSize = baseHeadSize + params.headSize * 0.02
    slots = slots.replaceAll('::Head-Scale::', headSize.toString())

    const baseNeckLength = -0.55
    const neckLength = baseNeckLength + params.neckLength * -0.02
    slots = slots.replaceAll('::Neck-Length::', neckLength.toString())

    slots = slots.replaceAll('::Head-In-Front::', params.headInFront ? '0.001' : '-0.001')

    const baseBodySize = 0.55
    const bodySize = baseBodySize + params.bodySize * 0.02
    slots = slots.replaceAll('::Body-Size::', bodySize.toString())

    slots = slots.replaceAll('::Tail-Active::', params.disableTail ? 'false' : 'true')

    const baseTailPosition = -0.12
    const tailPosition = baseTailPosition + params.tailPosition * 0.2
    slots = slots.replaceAll('::Tail-Position::', tailPosition.toString())
    slots = slots.replaceAll('::Tail-Rotation::', params.tailRotation.toString())

    const baseTailSize = 1.7
    const tailSize = baseTailSize + params.tailSize * 0.2
    slots = slots.replaceAll('::Tail-Scale::', tailSize.toString())

    slots = slots.replaceAll('::Legs-In-Front::', params.legsInFront ? '0.001' : '-0.001')

    const baseFeetDistance = 0.13
    const feetDistance = baseFeetDistance + params.legsDistanceFromBody * -0.015
    slots = slots.replaceAll('::Feet-Distance::', feetDistance.toString())

    const baseFeetSize = 0.5
    const feetSize = baseFeetSize + params.legsSize * 0.5
    slots = slots.replaceAll('::Feet-Size::', feetSize.toString())

    const baseLegsDistance = 0.38
    const legsDistance = baseLegsDistance + params.legsDistance * 0.03
    slots = slots.replaceAll('::Legs-Distance::', legsDistance.toString())

    const baseHandSize = 0.3
    const handSize = baseHandSize + params.handSize * 0.3
    slots = slots.replaceAll('::Hand-Scale::', handSize.toString())

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

export const createBaseAnimation = (params: AvatarParams) => {
    // headSize
    const track_headFrontScale = new VectorKeyframeTrack(
        'Head_Front.scale',
        [0],
        [params.headSize, params.headSize, params.headSize]
    )
    const track_headBackScale = new VectorKeyframeTrack(
        'Head_Back.scale',
        [0],
        [params.headSize, params.headSize, params.headSize]
    )
    // neckLength
    const track_bodyPosition = new VectorKeyframeTrack(
        'Body.position',
        [0],
        [0, -params.neckLength, params.headInFront ? -0.5 : 0.5]
    )
    // handSize
    const track_leftHandScale = new VectorKeyframeTrack(
        'LeftHand.scale',
        [0],
        [params.handSize, params.handSize, params.handSize]
    )
    const track_rightHandScale = new VectorKeyframeTrack(
        'RightHand.scale',
        [0],
        [params.handSize, params.handSize, params.handSize]
    )
    // bodySize
    const track_bodyFrontScale = new VectorKeyframeTrack(
        'Body_Front.scale',
        [0],
        [params.bodySize, params.bodySize, params.bodySize]
    )
    const track_bodyBackScale = new VectorKeyframeTrack(
        'Body_Back.scale',
        [0],
        [params.bodySize, params.bodySize, params.bodySize]
    )
    // tailSize
    const track_tailFrontScale = new VectorKeyframeTrack(
        'Tail_Front.scale',
        [0],
        [params.tailSize, params.tailSize, params.tailSize]
    )
    const track_tailBackScale = new VectorKeyframeTrack(
        'Tail_Back.scale',
        [0],
        [params.tailSize, params.tailSize, params.tailSize]
    )
    // tailPosition
    const track_tailPosition = new VectorKeyframeTrack('Tail.position', [0], [0, -params.tailPosition, 0])
    // tailRotation
    const rotation = new Quaternion().setFromEuler(new Euler(0, 0, params.tailRotation))
    const track_tailRotation = new QuaternionKeyframeTrack('Tail.quaternion', [0], [...rotation.toArray()])
    // legsSize
    const track_legsScale = new VectorKeyframeTrack(
        'Feet.scale',
        [0],
        [params.legsSize, params.legsSize, params.legsSize]
    )
    // legsDistance
    const track_legsLeftDistance = new VectorKeyframeTrack('LeftFoot.position', [0], [params.legsDistance, 0, 0])
    const track_legsRightDistance = new VectorKeyframeTrack('RightFoot.position', [0], [-params.legsDistance, 0, 0])
    // legsDistanceFromBody
    const track_legsPosition = new VectorKeyframeTrack(
        'Feet.position',
        [0],
        [0, -params.legsDistanceFromBody, params.legsInFront ? 0.5 : -0.5]
    )

    const clip = new AnimationClip('BaseAnimation', 1, [
        track_headFrontScale,
        track_headBackScale,
        track_bodyPosition,
        track_leftHandScale,
        track_rightHandScale,
        track_bodyFrontScale,
        track_bodyBackScale,
        track_tailFrontScale,
        track_tailBackScale,
        track_tailPosition,
        track_tailRotation,
        track_legsScale,
        track_legsLeftDistance,
        track_legsRightDistance,
        track_legsPosition
    ])
    clip.blendMode = AdditiveAnimationBlendMode
    return clip
}
