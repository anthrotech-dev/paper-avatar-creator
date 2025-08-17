import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Group,
    AnimationMixer,
    Mesh,
    AnimationClip,
    VectorKeyframeTrack,
    AdditiveAnimationBlendMode,
    QuaternionKeyframeTrack,
    Euler,
    Quaternion,
    Object3D,
    TextureLoader,
    SRGBColorSpace,
    Texture,
    MeshBasicMaterial
} from 'three'

import { textureKeyMap, type AvatarManifest } from '../types'
import { useGLTF } from '@react-three/drei'

import { useFrame, useGraph } from '@react-three/fiber'
import { FakeShadow } from './FakeShadow'

type AvatarEvent = {
    manifest: AvatarManifest
    target: Object3D
    textures: Record<string, Texture>
}

type AvatarProps = {
    id: string
    onLoad?: (manifest: AvatarManifest) => void
    onClick?: (_: AvatarEvent) => void
}

export const Avatar = (props: AvatarProps) => {
    const group = useRef<Group>(null)
    const { scene, animations } = useGLTF('/anim@RESO_Pera_idle.glb')
    const clone = useMemo(() => scene.clone(), [scene])
    const { nodes } = useGraph(clone)
    const mixer = useRef<AnimationMixer>(null)

    const [manifest, setManifest] = useState<AvatarManifest>()
    const params = manifest?.params

    const [textures, setTextures] = useState<Record<string, Texture> | null>()

    useEffect(() => {
        const endpoint = `https://pub-01b22329d1ae4699af72f1db7103a0ab.r2.dev/uploads/${props.id}/manifest.json`
        fetch(endpoint)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }
                return response.json()
            })
            .then((data: AvatarManifest) => {
                setManifest(data)

                const textureLoader = new TextureLoader()
                const texturePromises = Object.entries(data.textures).map(async ([key, url]) => {
                    const texture = await textureLoader.loadAsync(url)
                    texture.flipY = false
                    texture.colorSpace = SRGBColorSpace
                    return [key, texture] as const
                })

                Promise.all(texturePromises)
                    .then((loadedTextures) => {
                        const textureMap: Record<string, Texture> = {}
                        loadedTextures.forEach(([key, texture]) => {
                            textureMap[key] = texture
                        })
                        setTextures(textureMap)
                        props.onLoad?.(data)
                    })
                    .catch((error) => {
                        console.error('Error loading textures:', error)
                    })
            })
            .catch((error) => {
                console.error('Error fetching avatar manifest:', error)
            })
    }, [props.id])

    const baseAnim = useMemo(() => {
        if (!params) return null
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
            [0, params.legsDistanceFromBody, params.legsInFront ? 0.5 : -0.5]
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
    }, [params])

    useEffect(() => {
        if (!nodes || !manifest || !textures) return
        for (const key in nodes) {
            if (textureKeyMap[key] && nodes[key].type === 'Mesh') {
                const mesh = nodes[key] as Mesh
                mesh.material = new MeshBasicMaterial({
                    color: '#FFFFFF',
                    map: textures[textureKeyMap[key]],
                    alphaTest: 0.5,
                    toneMapped: false
                })
                mesh.material.needsUpdate = true
            }
        }
    }, [nodes, manifest, textures])

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
                props.onClick?.({
                    manifest: manifest!,
                    target: group.current!,
                    textures: textures || {}
                })
            }}
        >
            <primitive scale={[0.01, 0.01, 0.01]} ref={group} object={clone} />
            <FakeShadow />
        </group>
    )
}
