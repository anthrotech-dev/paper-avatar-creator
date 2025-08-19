import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Group,
    AnimationMixer,
    Mesh,
    AdditiveAnimationBlendMode,
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
import { a, useSpring } from '@react-spring/three'
import { createBaseAnimation } from '../util'

type AvatarEvent = {
    manifest: AvatarManifest
    target: Object3D
    texture: Texture | null
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

    const [texture, setTexture] = useState<Texture | null>(null)
    const [loaded, setLoaded] = useState(false)
    const { position, opacity } = useSpring({
        position: loaded ? 0 : 5.0,
        opacity: loaded ? 0.4 : 0,
        config: { tension: 220, friction: 20 }
    })

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
                textureLoader.loadAsync(data.textureURL).then((texture) => {
                    texture.flipY = false
                    texture.colorSpace = SRGBColorSpace

                    setTexture(texture)
                    props.onLoad?.(data)
                    setTimeout(
                        () => {
                            setLoaded(true)
                        },
                        Math.random() * 1000 + 500
                    ) // Random delay between 500ms and 1500ms
                })
            })
            .catch((error) => {
                console.error('Error fetching avatar manifest:', error)
            })
    }, [props.id])

    useEffect(() => {
        if (!texture || !nodes) return
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
        <group>
            <a.group
                position={position.to((x) => [0, Math.abs(x), 0])}
                onPointerDown={(e) => {
                    e.stopPropagation()
                    props.onClick?.({
                        manifest: manifest!,
                        target: group.current!,
                        texture: texture || null
                    })
                }}
            >
                <primitive scale={[0.01, 0.01, 0.01]} ref={group} object={clone} />
            </a.group>
            <FakeShadow opacity={opacity} />
        </group>
    )
}
