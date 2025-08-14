import { useEffect, useMemo, useRef } from 'react'
import {
    Texture,
    Group,
    AnimationMixer,
    MeshPhongMaterial,
    Mesh,
    AnimationClip,
    VectorKeyframeTrack,
    AdditiveAnimationBlendMode,
    QuaternionKeyframeTrack,
    Euler,
    Quaternion,
    Object3D
} from 'three'

import { textureKeyMap, type AvatarParams, type TextureKind } from '../types'
import { useGLTF } from '@react-three/drei'

import { useFrame, useGraph } from '@react-three/fiber'
import { FakeShadow } from './FakeShadow'

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

    const baseAnim = useMemo(() => {
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
        const track_bodyPosition = new VectorKeyframeTrack('Body.position', [0], [0, -params.neckLength, 0])
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
        const track_legsPosition = new VectorKeyframeTrack('Feet.position', [0], [0, params.legsDistanceFromBody, 0])

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
