import { useEffect, useRef, useState } from 'react'
import {
    Texture,
    Group,
    AnimationMixer,
    MeshPhongMaterial,
    Mesh,
    AnimationClip,
    VectorKeyframeTrack,
    AdditiveAnimationBlendMode
} from 'three'

import { textureKeyMap, type AvatarParams, type TextureKind } from './types'
import { useGLTF } from '@react-three/drei'

import { useFrame } from '@react-three/fiber'

export function Avatar({
    params,
    textures,
    editing
}: {
    params: AvatarParams
    textures: Record<string, Texture>
    editing: TextureKind | null
}) {
    const group = useRef<Group>(null)
    const { nodes, scene, animations } = useGLTF('/anim@RESO_Pera_idle.glb')
    const mixer = useRef<AnimationMixer>(null)

    /*
    useEffect(() => {
        //console.log('Scene loaded:', scene)
        scene.traverse((child) => {
            console.log(child.name, child.type)
        })
    }, [scene])
    */

    const [baseAnim, setBaseAnim] = useState<AnimationClip | null>(null)

    useEffect(() => {
        const track_bodyPosition = new VectorKeyframeTrack('Body.position', [0], [0, -params.neckLength, 0])

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

        const clip = new AnimationClip('BaseAnimation', 1, [
            track_headFrontScale,
            track_headBackScale,
            track_bodyPosition
        ])
        clip.blendMode = AdditiveAnimationBlendMode
        setBaseAnim(clip)

        /*
        //console.log(Object.keys(nodes))
        const headback = nodes['Head_Back']
        if (headback) {
            headback.scale.set(params.headSize, params.headSize, params.headSize)
        }
        const headfront = nodes['Head_Front']
        if (headfront) {
            headfront.scale.set(params.headSize, params.headSize, params.headSize)
        }
        const body = nodes['Body']
        if (body) {
            body.traverse((child) => {
                console.log('body child:', child.name, child.type)
            })
            //body.position.set(0, params.neckLength, 0)
            body.position.setY(-params.neckLength)
        }
        */
    }, [params])

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
                // console.log(`Set texture for ${key} to ${textureKeyMap[key]}`)
            } else {
                // console.warn(`No texture for ${key}`)
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
        if (!mixer.current || !baseAnim) return
        console.log('Setting up base animation:', baseAnim.name)
        const action = mixer.current.clipAction(baseAnim)
        action.blendMode = AdditiveAnimationBlendMode
        action.play()

        return () => {
            action.stop()
        }
    }, [baseAnim, mixer])

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
