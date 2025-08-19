import { useEffect, useMemo, useRef } from 'react'
import { Texture, Group, AnimationMixer, Mesh, AdditiveAnimationBlendMode, Object3D, MeshBasicMaterial } from 'three'

import { textureKeyMap, type AvatarParams } from '../types'
import { useGLTF } from '@react-three/drei'

import { useFrame, useGraph } from '@react-three/fiber'
import { FakeShadow } from './FakeShadow'
import { createBaseAnimation } from '../util'

type AvatarProps = {
    params: AvatarParams
    texture: Texture
    setSelected?: (selected: Object3D | null) => void
}

export const EditableAvatar = ({ params, texture, setSelected }: AvatarProps) => {
    const group = useRef<Group>(null)
    const { scene, animations } = useGLTF('/anim@RESO_Pera_idle.glb')
    const clone = useMemo(() => scene.clone(), [scene])
    const { nodes } = useGraph(clone)
    const mixer = useRef<AnimationMixer>(null)

    useEffect(() => {
        const faceMaterial = new MeshBasicMaterial({
            color: '#FFFFFF',
            map: texture.clone(),
            alphaTest: 0.5
        })

        const bodyMaterial = new MeshBasicMaterial({
            color: '#FFFFFF',
            map: texture.clone(),
            alphaTest: 0.5
        })

        for (const key in nodes) {
            if (textureKeyMap[key] && nodes[key].type === 'Mesh') {
                const mesh = nodes[key] as Mesh
                if (key === 'Head_Front') {
                    mesh.material = faceMaterial
                } else {
                    mesh.material = bodyMaterial
                }
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

    let facial: 'Head-Front' | 'Eyes-Closed' | 'Mouth-Open' = 'Head-Front'
    const chanceToCloseEyes = 0.004
    const chanceToOpenMouth = 0.002
    const chanceToReturnToNormal = 0.05
    useFrame((_state, delta) => {
        mixer.current?.update(delta)
        if (facial === 'Head-Front') {
            if (Math.random() < chanceToCloseEyes) {
                facial = 'Eyes-Closed'
                // @ts-ignore
                nodes['Head_Front'].material.map.offset.set(0.166, 0)
            } else if (Math.random() < chanceToOpenMouth) {
                facial = 'Mouth-Open'
                // @ts-ignore
                nodes['Head_Front'].material.map.offset.set(0.167, 0)
            }
        } else if (facial === 'Eyes-Closed') {
            if (Math.random() < chanceToReturnToNormal) {
                facial = 'Head-Front'
                // @ts-ignore
                nodes['Head_Front'].material.map.offset.set(0, 0)
            }
        } else if (facial === 'Mouth-Open') {
            if (Math.random() < chanceToReturnToNormal) {
                facial = 'Head-Front'
                // @ts-ignore
                nodes['Head_Front'].material.map.offset.set(0, 0)
            }
        }
    })

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
