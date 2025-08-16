import { createContext, memo, Suspense, useContext, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Object3D, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three'

import { Avatar } from '../components/Avatar'
import { Wanderer } from '../components/Wanderer'
import { FollowCamera } from '../components/FollowCamera'
import { Box, Button, Divider, Fab, Typography } from '@mui/material'
import { MdAdd } from 'react-icons/md'
import { type AvatarManifest } from '../types'
import { Drawer } from '../ui/Drawer'
import { handleResoniteExport } from '../util'
import { useEditor } from './Editor'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

type PlazaState = {
    selected: Object3D | null
    setSelected: Dispatch<SetStateAction<Object3D | null>>
    textures: Record<string, Texture>
    setTextures: Dispatch<SetStateAction<Record<string, Texture>>>
    selectedManifest: AvatarManifest | null
    setSelectedManifest: (manifest: AvatarManifest | null) => void
}

const PlazaContext = createContext<PlazaState | null>(null)

const usePlaza = () => {
    const ctx = useContext(PlazaContext)
    if (!ctx) {
        return {
            selected: null,
            setSelected: () => {},
            textures: {},
            setTextures: () => {},
            selectedManifest: null,
            setSelectedManifest: () => {}
        }
    }
    return ctx
}

export function Plaza({ children }: { children?: React.ReactNode }) {
    const [selected, setSelected] = useState<Object3D | null>(null)
    const [selectedManifest, setSelectedManifest] = useState<AvatarManifest | null>(null)
    const [textures, setTextures] = useState<Record<string, Texture>>({})

    return (
        <PlazaContext.Provider
            value={{
                textures,
                selectedManifest,
                setTextures,
                setSelectedManifest,
                selected,
                setSelected
            }}
        >
            {children}
        </PlazaContext.Provider>
    )
}

const FadingFloorMaterial = shaderMaterial(
    {
        map: null,
        fadeRadius: 100.0
    },
    // vertex shader
    `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
    // fragment shader
    `
  uniform sampler2D map;
  uniform float fadeRadius;
  varying vec2 vUv;
  varying vec3 vPos;

  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0., 1./3., 2./3.)) * 6. - 3.);
    return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y);
  }


  void main() {
    vec4 tex = texture2D(map, vUv * vec2(10.0, 20.0));
    
    float dist = length(vPos.xz);
    float fade = clamp(dist / fadeRadius, 0.0, 1.0);

    vec3 hsv = vec3(dist*0.01+0.35, 0.1, 0.9);
    vec3 hue = hsv2rgb(hsv);

    vec3 pattern = mix(vec3(1.0), hue, tex.w);
    vec3 color = mix(pattern, vec3(1.0), fade);

    gl_FragColor = vec4(color, 1.0);
  }
  `
)

extend({ FadingFloorMaterial })

Plaza.Scene = (props: { avatars: string[]; setView: (position: Vector3, lookAt: Vector3, speed: number) => void }) => {
    const { selected, setSelected, setSelectedManifest, setTextures } = usePlaza()

    const texture = useMemo(() => {
        const textureLoader = new TextureLoader()
        const texture = textureLoader.load('/tex/tile.png')
        texture.colorSpace = SRGBColorSpace
        texture.wrapS = RepeatWrapping
        texture.wrapT = RepeatWrapping
        return texture
    }, [])

    return (
        <>
            <group>
                <mesh
                    //rotation={[-Math.PI / 2, 0, 0]}
                    onPointerDown={(e) => {
                        e.stopPropagation()
                        setSelected(null)
                        setSelectedManifest(null)
                        if (selected) {
                            props.setView(new Vector3(-2, 2, 10), new Vector3(0, 0, 0), 1)
                        }
                    }}
                    position={[0, -0.005, 0]}
                >
                    <cylinderGeometry args={[20.0, 20.0, 0.01, 32]} />
                    <fadingFloorMaterial fadeRadius={20} map={texture} />
                </mesh>
                <AvatarsRenderer
                    setTextures={setTextures}
                    avatars={props.avatars}
                    setSelectedManifest={setSelectedManifest}
                    setSelected={setSelected}
                />
            </group>
            <FollowCamera target={selected} />
        </>
    )
}

const AvatarsRenderer = memo(
    ({
        avatars,
        setSelectedManifest,
        setSelected,
        setTextures
    }: {
        avatars: string[]
        setSelectedManifest: (_: AvatarManifest | null) => void
        setSelected: (_: Object3D | null) => void
        setTextures: Dispatch<SetStateAction<Record<string, Texture>>>
    }) => {
        return (
            <>
                {avatars.map((id) => (
                    <Wanderer
                        key={id}
                        initial={[Math.random() * 10 - 5, 0, Math.random() * 10 - 5]}
                        bounds={5}
                        baseSpeed={0.5}
                    >
                        <Suspense fallback={null}>
                            <Avatar
                                id={id}
                                onClick={(e) => {
                                    setSelected(e.target)
                                    setSelectedManifest(e.manifest)
                                    setTextures(e.textures)
                                }}
                            />
                        </Suspense>
                    </Wanderer>
                ))}
            </>
        )
    }
)

Plaza.Overlay = (props: {
    setView: (position: Vector3, lookAt: Vector3, speed: number) => void
    setMode: (mode: 'edit' | 'plaza') => void
    setCollection: Dispatch<SetStateAction<string[]>>
}) => {
    const { setSelected, selectedManifest, setSelectedManifest, textures } = usePlaza()

    const { setTextures, setParent } = useEditor()

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
                onClick={() => {
                    props.setMode('edit')
                    props.setView(new Vector3(0, 10.5, 3), new Vector3(0, 10.5, 0), 1)
                }}
            >
                <MdAdd style={{ width: '2rem', height: '2rem', color: 'white' }} />
            </Fab>
            <Drawer open={!!selectedManifest}>
                {selectedManifest && (
                    <Box
                        sx={{
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}
                    >
                        <Typography variant="h2">{selectedManifest.name}</Typography>
                        <Typography>Creator: {selectedManifest.creator}</Typography>
                        <Divider />
                        <Typography>{selectedManifest.description}</Typography>
                        <Box flex={1} />
                        <Button
                            variant="contained"
                            disabled={!selectedManifest.exportable}
                            onClick={() => {
                                handleResoniteExport(textures)
                            }}
                        >
                            Resonite用に書き出し
                        </Button>
                        <Button
                            variant="contained"
                            disabled={!selectedManifest.editable}
                            onClick={() => {
                                setTextures(textures)
                                setParent(selectedManifest)
                                setSelected(null)
                                setSelectedManifest(null)
                                props.setView(new Vector3(0, 10.5, 3), new Vector3(0, 10.5, 0), 1)
                                props.setMode('edit')
                            }}
                        >
                            改変する
                        </Button>
                        <Button
                            color="primary"
                            variant="contained"
                            onClick={() => {
                                navigator.clipboard.writeText(location.origin + '/' + selectedManifest.id)
                            }}
                        >
                            URLをコピー
                        </Button>
                        <Button
                            color="error"
                            variant="contained"
                            onClick={() => {
                                props.setMode('plaza')
                                props.setCollection((c) => c.filter((id) => id !== selectedManifest.id))
                                setSelectedManifest(null)
                                props.setView(new Vector3(-2, 2, 10), new Vector3(0, 0, 0), 1)
                            }}
                        >
                            コレクションから削除
                        </Button>
                    </Box>
                )}
            </Drawer>
        </>
    )
}
