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
import { createBaseAnimation } from '../util'

export type StreamAvatarInfo = {
    id: string
    manifest: AvatarManifest
    target: Object3D | null
    texture: Texture | null
}

type StreamAvatarProps = {
    id: string
}

export const StreamAvatar = (props: StreamAvatarProps) => {
    const group = useRef<Group>(null)
    const { scene, animations } = useGLTF('/anim@RESO_Pera_idle.glb')
    const clone = useMemo(() => scene.clone(), [scene])
    const { nodes } = useGraph(clone)
    const mixer = useRef<AnimationMixer>(null)

    const [manifest, setManifest] = useState<AvatarManifest>()
    const params = manifest?.params

    const [texture, setTexture] = useState<Texture | null>(null)

    const analyserRef = useRef<AnalyserNode>(null)
    const dataArrayRef = useRef<Uint8Array>(null)

    useEffect(() => {
        navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
                const audioContext = new AudioContext()
                const source = audioContext.createMediaStreamSource(stream)

                const analyser = audioContext.createAnalyser()
                analyser.fftSize = 2048
                analyserRef.current = analyser

                const bufferLength = analyser.fftSize
                const dataArray = new Uint8Array(bufferLength)
                dataArrayRef.current = dataArray
                source.connect(analyser)
            })
            .catch((err) => {
                alert('マイクが取得できませんでした' + err.message)
            })
    }, [])

    useEffect(() => {
        const endpoint = `https://pub-01b22329d1ae4699af72f1db7103a0ab.r2.dev/uploads/${props.id}/manifest.json`
        setManifest(undefined)
        setTexture(null)
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

    const chanceToCloseEyes = 0.004
    const chanceToReturnToNormal = 0.05
    let wantedBlink = false
    useFrame((_state, delta) => {
        mixer.current?.update(delta)

        const analyser = analyserRef.current
        const dataArray = dataArrayRef.current
        if (!analyser || !dataArray) return

        analyser.getByteTimeDomainData(dataArray)

        let sumSquares = 0
        for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128 // 中心0
            sumSquares += v * v
        }
        const rms = Math.sqrt(sumSquares / dataArray.length)

        const THRESHOLD = 0.02
        if (rms > THRESHOLD) {
            // 口を開ける
            // @ts-ignore
            nodes['Head_Front'].material.map.offset.set(-0.167, 0)
        } else {
            // 正常に戻す
            if (wantedBlink) {
                // @ts-ignore
                nodes['Head_Front'].material.map.offset.set(0.166, 0)
            } else {
                // @ts-ignore
                nodes['Head_Front'].material.map.offset.set(0, 0)
            }
        }

        if (wantedBlink && Math.random() < chanceToReturnToNormal) {
            wantedBlink = false
        } else if (!wantedBlink && Math.random() < chanceToCloseEyes) {
            wantedBlink = true
        }
    })

    return <primitive scale={[0.01, 0.01, 0.01]} ref={group} object={clone} />
}
