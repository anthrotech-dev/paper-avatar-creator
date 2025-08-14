import { type JSX, Suspense, useEffect, useState } from 'react'
import { Texture, TextureLoader, SRGBColorSpace, Object3D } from 'three'

import { type AvatarParams, type TextureKind } from '../types'
import { Avatar } from '../components/Avatar'
import { Wanderer } from '../components/Wanderer'
import { FollowCamera } from '../components/FollowCamera'

import { MdAdd } from 'react-icons/md'
import { Fab } from '@mui/material'

export function Plaza({ children }: { children: JSX.Element[] | JSX.Element }) {
    return <>{children}</>
}

Plaza.Scene = () => {
    const [textures, setTextures] = useState<Record<string, Texture>>({})
    const [selected, setSelected] = useState<Object3D | null>(null)

    const [avatarParams] = useState<AvatarParams>({
        headSize: 0,
        neckLength: 0,
        headInFront: true,
        handSize: 0,
        bodySize: 0,
        tailSize: 0,
        tailPosition: 0,
        tailRotation: 0,
        legsSize: 0,
        legsDistance: 0,
        legsDistanceFromBody: 0,
        legsInFront: true
    })

    useEffect(() => {
        ;(async () => {
            const loader = new TextureLoader()
            const textures: Record<TextureKind, Texture> = {
                'Head-Front': await loader.loadAsync('/tex/Head-Front.png'),
                'Head-Back': await loader.loadAsync('/tex/Head-Back.png'),
                'Eyes-Closed': await loader.loadAsync('/tex/Eyes-Closed.png'),
                'Mouth-Open': await loader.loadAsync('/tex/Mouth-Open.png'),
                'Body-Front': await loader.loadAsync('/tex/Body-Front.png'),
                'Body-Back': await loader.loadAsync('/tex/Body-Back.png'),
                'Hand-Front': await loader.loadAsync('/tex/Hand-Front.png'),
                'Hand-Back': await loader.loadAsync('/tex/Hand-Back.png'),
                'Legs-Front': await loader.loadAsync('/tex/Legs-Front.png'),
                'Legs-Back': await loader.loadAsync('/tex/Legs-Back.png'),
                'Tail-Front': await loader.loadAsync('/tex/Tail-Front.png'),
                'Tail-Back': await loader.loadAsync('/tex/Tail-Back.png')
            }

            for (const key in textures) {
                textures[key as TextureKind].flipY = false
                textures[key as TextureKind].colorSpace = SRGBColorSpace
            }

            setTextures(textures)
        })()
    }, [])

    return (
        <>
            <group>
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    onPointerDown={(e) => {
                        e.stopPropagation()
                        setSelected(null)
                    }}
                >
                    <planeGeometry args={[200, 200]} />
                    <meshStandardMaterial color="#3a3a3a" roughness={1} metalness={0} />
                </mesh>

                <gridHelper args={[200, 200, 0x888888, 0x444444]} position={[0, 0.001, 0]} />
            </group>

            <Wanderer initial={[0, 0, 0]} bounds={5} baseSpeed={0.5}>
                <Suspense fallback={null}>
                    <Avatar params={avatarParams} editing={null} textures={textures} setSelected={setSelected} />
                </Suspense>
            </Wanderer>
            <FollowCamera target={selected} />
        </>
    )
}

Plaza.Overlay = () => {
    return (
        <>
            <Fab
                color="primary"
                sx={{
                    position: 'absolute',
                    bottom: '2rem',
                    right: '2rem',
                    zIndex: 1000
                }}
            >
                <MdAdd style={{ width: '2rem', height: '2rem', color: 'white' }} />
            </Fab>
        </>
    )
}
