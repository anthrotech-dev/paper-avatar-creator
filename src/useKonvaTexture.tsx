import Konva from 'konva'
import { useEffect, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

export function useKonvaTexture(layerRef: React.RefObject<Konva.Layer | null>, event: any): CanvasTexture {
    const [tex] = useState(() => new CanvasTexture(document.createElement('canvas')))

    useEffect(() => {
        const layer = layerRef.current
        if (!layer) return

        // scene 用キャンバスを直接参照
        const canvas: HTMLCanvasElement = layer.getNativeCanvasElement()
        tex.flipY = false
        tex.image = canvas
        tex.needsUpdate = true
        tex.colorSpace = SRGBColorSpace

        // Konva が何か描いたら GPU 転送を更新
        const update = () => {
            console.log('Konva texture update')
            tex.needsUpdate = true
        }
        layer.on('draw', update)

        return () => {
            layer.off('draw', update)
        }
    }, [layerRef, tex, event])

    return tex
}
