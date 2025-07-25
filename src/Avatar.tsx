import { useEffect, useRef } from 'react'
import { Texture, Group, AnimationMixer, MeshPhongMaterial, Mesh } from 'three'

import { textureKeyMap, type TextureKind } from './types'
import { useGLTF } from '@react-three/drei'

import { useFrame } from '@react-three/fiber'

export function Avatar({ textures, editing }: { textures: Record<string, Texture>; editing: TextureKind | null }) {
    const group = useRef<Group>(null)
    const { nodes, scene, animations } = useGLTF('/anim@RESO_Pera_idle.glb')
    const mixer = useRef<AnimationMixer>(null)

    useEffect(() => {
        for (const key in nodes) {
            if (textureKeyMap[key] && nodes[key].type === 'Mesh') {
                const mesh = nodes[key] as Mesh
                mesh.material = new MeshPhongMaterial({
                    color: '#FFFFFF',
                    map: textures[textureKeyMap[key]],
                    flatShading: true,
                    alphaTest: 0.5
                })
                mesh.material.needsUpdate = true
                console.log(`Set texture for ${key} to ${textureKeyMap[key]}`)
            } else {
                console.warn(`No texture for ${key}`)
            }
        }
    }, [nodes, textures])

    useEffect(() => {
        if (animations.length && group.current) {
            mixer.current = new AnimationMixer(group.current)
            animations.forEach((clip) => {
                mixer.current?.clipAction(clip)?.play()
            })
        }
        return () => {
            mixer.current?.stopAllAction()
        }
    }, [animations])

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

    return <primitive position={[-1, 0, 0]} scale={[0.01, 0.01, 0.01]} ref={group} object={scene} />
}
