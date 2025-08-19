import { useEffect, useMemo, useRef } from 'react'
import { Texture, Group, AnimationMixer, Mesh, AdditiveAnimationBlendMode, Object3D, MeshBasicMaterial } from 'three'

import { textureKeyMap, type AvatarParams } from '../types'
import { useGLTF } from '@react-three/drei'

import { useGraph } from '@react-three/fiber'
import { FakeShadow } from './FakeShadow'
import { createBaseAnimation } from '../util'

type AvatarProps = {
    params: AvatarParams
    texture: Texture
    setSelected?: (selected: Object3D | null) => void
}

export const ThumbnailAvatar = ({ params, texture, setSelected }: AvatarProps) => {
    const group = useRef<Group>(null)
    const { scene, animations } = useGLTF('/anim@RESO_Pera_thumbnail.glb')
    const clone = useMemo(() => scene.clone(), [scene])
    const { nodes } = useGraph(clone)
    const mixer = useRef<AnimationMixer>(null)

    useEffect(() => {
        const material = new MeshBasicMaterial({
            color: '#FFFFFF',
            map: texture.clone(),
            alphaTest: 0.5
        })

        for (const key in nodes) {
            if (textureKeyMap[key] && nodes[key].type === 'Mesh') {
                const mesh = nodes[key] as Mesh
                mesh.material = material
            }
        }
    }, [nodes, texture])

    useEffect(() => {
        if (group.current) {
            mixer.current = new AnimationMixer(group.current)
        }
        return () => {
            mixer.current?.stopAllAction()
        }
    }, [group])

    useEffect(() => {
        if (!mixer.current || !animations) return

        const actions = animations.map((clip) => {
            const action = mixer.current?.clipAction(clip)
            if (!action) return null
            action.play()
            return action
        })

        return () => {
            actions.forEach((action) => {
                action?.stop()
            })
        }
    }, [animations, mixer])

    useEffect(() => {
        if (!mixer.current || !params) return
        const baseAnim = createBaseAnimation(params)
        const action = mixer.current.clipAction(baseAnim)
        action.blendMode = AdditiveAnimationBlendMode
        action.play()

        const TailNode = nodes['Tail']
        if (TailNode) TailNode.visible = !params.disableTail

        return () => {
            action.stop()
        }
    }, [params, mixer])

    return (
        <group
            onPointerDown={(e) => {
                e.stopPropagation()
                setSelected?.(group.current)
            }}
        >
            <primitive scale={[0.01, 0.01, 0.01]} ref={group} object={clone} />
            <FakeShadow />
        </group>
    )
}
