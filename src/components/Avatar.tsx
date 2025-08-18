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
    const [loaded, setLoaded] = useState(false)
    const { s } = useSpring({
        s: loaded ? 1.0 : 0,
        config: { duration: 250 }
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
                        setLoaded(true)
                    })
                    .catch((error) => {
                        console.error('Error loading textures:', error)
                    })
            })
            .catch((error) => {
                console.error('Error fetching avatar manifest:', error)
            })
    }, [props.id])

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
        if (!mixer.current || !params) return
        const baseAnim = createBaseAnimation(params)
        const action = mixer.current.clipAction(baseAnim)
        action.blendMode = AdditiveAnimationBlendMode
        action.play()

        return () => {
            action.stop()
        }
    }, [params, mixer])

    let facial: 'Head-Front' | 'Eyes-Closed' | 'Mouth-Open' = 'Head-Front'
    const chanceToCloseEyes = 0.004
    const chanceToOpenMouth = 0.002
    const chanceToReturnToNormal = 0.05
    useFrame((_state, delta) => {
        if (!loaded) return
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
        <a.group
            scale={s}
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
        </a.group>
    )
}
