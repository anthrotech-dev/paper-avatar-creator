import { useEffect, useMemo, useRef } from 'react'
import { Texture, Group, AnimationMixer, Mesh, AdditiveAnimationBlendMode, Object3D, MeshBasicMaterial } from 'three'

import { textureKeyMap, type AvatarParams, type TextureKind } from '../types'
import { useGLTF } from '@react-three/drei'

import { useFrame, useGraph } from '@react-three/fiber'
import { FakeShadow } from './FakeShadow'
import { createBaseAnimation } from '../util'

type AvatarProps = {
    params: AvatarParams
    textures: Record<string, Texture>
    editing: TextureKind | null
    setSelected?: (selected: Object3D | null) => void
}

export const EditableAvatar = ({ params, textures, editing, setSelected }: AvatarProps) => {
    const group = useRef<Group>(null)
    const { scene, animations } = useGLTF('/anim@RESO_Pera_idle.glb')
    const clone = useMemo(() => scene.clone(), [scene])
    const { nodes } = useGraph(clone)
    const mixer = useRef<AnimationMixer>(null)

    useEffect(() => {
        for (const key in nodes) {
            if (textureKeyMap[key] && nodes[key].type === 'Mesh') {
                const mesh = nodes[key] as Mesh
                mesh.material = new MeshBasicMaterial({
                    color: '#FFFFFF',
                    map: textures[textureKeyMap[key]],
                    alphaTest: 0.5
                })
                mesh.material.needsUpdate = true
            }
        }
    }, [nodes, textures])

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

        return () => {
            action.stop()
        }
    }, [params, mixer])

    useEffect(() => {
        switch (editing) {
            case 'Head-Front':
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Head-Front']
                break
            case 'Eyes-Closed':
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Eyes-Closed']
                break
            case 'Mouth-Open':
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Mouth-Open']
                break
        }
    }, [editing])

    let facial: 'Head-Front' | 'Eyes-Closed' | 'Mouth-Open' = 'Head-Front'
    const chanceToCloseEyes = 0.004
    const chanceToOpenMouth = 0.002
    const chanceToReturnToNormal = 0.05
    useFrame((_state, delta) => {
        mixer.current?.update(delta)
        if (editing) return
        if (facial === 'Head-Front') {
            if (Math.random() < chanceToCloseEyes) {
                facial = 'Eyes-Closed'
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Eyes-Closed']
            } else if (Math.random() < chanceToOpenMouth) {
                facial = 'Mouth-Open'
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Mouth-Open']
            }
        } else if (facial === 'Eyes-Closed') {
            if (Math.random() < chanceToReturnToNormal) {
                facial = 'Head-Front'
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Head-Front']
            }
        } else if (facial === 'Mouth-Open') {
            if (Math.random() < chanceToReturnToNormal) {
                facial = 'Head-Front'
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Head-Front']
            }
        }
    })

    return (
        <group
            onPointerDown={(e) => {
                e.stopPropagation()
                console.log('Avatar clicked', e)
                setSelected?.(group.current)
            }}
        >
            <primitive scale={[0.01, 0.01, 0.01]} ref={group} object={clone} />
            <FakeShadow />
        </group>
    )
}
