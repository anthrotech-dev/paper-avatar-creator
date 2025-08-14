import { useMemo } from 'react'
import { CanvasTexture, ClampToEdgeWrapping } from 'three'

interface FakeShadowProps {
    radius?: number
    opacity?: number
}

export function FakeShadow({ radius = 0.45, opacity = 0.65 }: FakeShadowProps) {
    const texture = useMemo(() => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx = canvas.getContext('2d')!

        const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5)
        g.addColorStop(0, 'rgba(0,0,0,1)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, size, size)

        const tex = new CanvasTexture(canvas)
        tex.wrapS = tex.wrapT = ClampToEdgeWrapping
        tex.needsUpdate = true
        return tex
    }, [])

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} renderOrder={-1}>
            <planeGeometry args={[radius * 2, radius * 2]} />
            <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
        </mesh>
    )
}
