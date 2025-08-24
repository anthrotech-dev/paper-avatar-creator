import {
    createContext,
    memo,
    Suspense,
    useContext,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type SetStateAction
} from 'react'
import { Object3D, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three'

import { Avatar } from '../components/Avatar'
import { Wanderer } from '../components/Wanderer'
import { FollowCamera } from '../components/FollowCamera'
import { Alert, Box, Button, Divider, Fab, IconButton, Link, Typography } from '@mui/material'
import { MdAdd } from 'react-icons/md'
import { type AvatarManifest } from '../types'
import { Drawer } from '../ui/Drawer'
import { handleExport, handleResoniteExport } from '../util'
import { useEditor } from './Editor'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import { useNavigate, Link as NavLink } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { CfmRenderer } from '../ui/CfmRenderer'
import { useTranslation } from 'react-i18next'

import { TfiShiftLeftAlt } from 'react-icons/tfi'
import { TfiShiftRightAlt } from 'react-icons/tfi'

type PlazaState = {
    selected: Object3D | null
    setSelected: Dispatch<SetStateAction<Object3D | null>>
    texture: Texture | null
    setTexture: Dispatch<SetStateAction<Texture | null>>
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
            texture: {},
            setTexture: () => {},
            selectedManifest: null,
            setSelectedManifest: () => {}
        }
    }
    return ctx
}

export function Plaza({ children }: { children?: React.ReactNode }) {
    const [selected, setSelected] = useState<Object3D | null>(null)
    const [selectedManifest, setSelectedManifest] = useState<AvatarManifest | null>(null)
    const [texture, setTexture] = useState<Texture | null>(null)

    return (
        <PlazaContext.Provider
            value={{
                texture,
                selectedManifest,
                setTexture,
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
    const { selected, setSelected, setSelectedManifest, setTexture } = usePlaza()

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
                    {/* @ts-ignore */}
                    <fadingFloorMaterial fadeRadius={20} map={texture} />
                </mesh>
                <AvatarsRenderer
                    setTexture={setTexture}
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
        setTexture
    }: {
        avatars: string[]
        setSelectedManifest: (_: AvatarManifest | null) => void
        setSelected: (_: Object3D | null) => void
        setTexture: Dispatch<SetStateAction<Texture | null>>
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
                                    setTexture(e.texture)
                                }}
                            />
                        </Suspense>
                    </Wanderer>
                ))}
            </>
        )
    }
)

Plaza.Overlay = (props: { setCollection: Dispatch<SetStateAction<string[]>>; deviceID: string }) => {
    const { setSelected, selectedManifest, setSelectedManifest, texture } = usePlaza()
    const { setTexture, setParent, setAvatarParams } = useEditor()
    const navigate = useNavigate()

    const { t } = useTranslation('')
    const [forceDrawerClose, setForceDrawerClose] = useState(false)

    useEffect(() => {
        setForceDrawerClose(false)
    }, [selectedManifest])

    return (
        <>
            {selectedManifest && (
                <Helmet>
                    <title>
                        {t('title')} | {selectedManifest.name}
                    </title>
                    <meta name="description" content={selectedManifest.description} />
                </Helmet>
            )}
            {selectedManifest ? (
                <>
                    <IconButton
                        onClick={() => {
                            setForceDrawerClose(false)
                        }}
                        sx={{
                            position: 'absolute',
                            bottom: '2rem',
                            right: '2rem',
                            zIndex: 1000
                        }}
                    >
                        <TfiShiftLeftAlt
                            style={{
                                width: '2rem',
                                height: '2rem',
                                color: 'black'
                            }}
                        />
                    </IconButton>
                </>
            ) : (
                <Fab
                    color="primary"
                    sx={{
                        position: 'absolute',
                        bottom: '2rem',
                        right: '2rem',
                        zIndex: 1000
                    }}
                    onClick={() => {
                        navigate('/edit')
                    }}
                >
                    <MdAdd style={{ width: '2rem', height: '2rem', color: 'white' }} />
                </Fab>
            )}
            <Drawer open={!!selectedManifest && !forceDrawerClose} onClose={() => setSelectedManifest(null)}>
                <IconButton
                    sx={{
                        position: 'absolute',
                        bottom: '1rem',
                        left: '1rem',
                        zIndex: 1000
                    }}
                >
                    <TfiShiftRightAlt
                        style={{
                            width: '2rem',
                            height: '2rem',
                            color: 'black'
                        }}
                        onClick={() => {
                            setForceDrawerClose(true)
                        }}
                    />
                </IconButton>
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
                        {selectedManifest.creatorID === props.deviceID && (
                            <Alert severity="success">{t('yourcreation')}</Alert>
                        )}
                        {selectedManifest.extends && (
                            <Link
                                component={NavLink}
                                to={'/' + selectedManifest.extends}
                                onClick={() => {
                                    setSelected(null)
                                    setSelectedManifest(null)
                                }}
                            >
                                {t('extends')}
                            </Link>
                        )}
                        <Divider />
                        {selectedManifest.description && <CfmRenderer message={selectedManifest.description} />}
                        <Box flex={1} />
                        <Button
                            variant="contained"
                            disabled={!selectedManifest.exportable && selectedManifest.creatorID !== props.deviceID}
                            onClick={() => {
                                if (!texture) {
                                    console.error('No texture available for export')
                                    return
                                }
                                handleResoniteExport(selectedManifest, texture)
                            }}
                        >
                            {t('exportResonite')}
                        </Button>
                        {selectedManifest.creatorID === props.deviceID && (
                            <Button
                                variant="contained"
                                onClick={() => {
                                    if (!texture) {
                                        return
                                    }
                                    handleExport(selectedManifest, texture)
                                }}
                            >
                                {t('exportZip')}
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            disabled={!selectedManifest.editable && selectedManifest.creatorID !== props.deviceID}
                            onClick={() => {
                                if (texture) setTexture(texture)
                                setParent(selectedManifest)
                                setAvatarParams(selectedManifest.params)
                                setSelected(null)
                                setSelectedManifest(null)
                                navigate('/edit')
                            }}
                        >
                            {t('modify')}
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {
                                window.open(
                                    `https://x.com/intent/tweet?text=${encodeURIComponent(
                                        `#OekakiAvatar
${location.origin}/${selectedManifest.id}`
                                    )}`
                                )
                            }}
                        >
                            {t('shareToX')}
                        </Button>
                        <Button
                            color="primary"
                            variant="contained"
                            onClick={() => {
                                navigator.clipboard.writeText(location.origin + '/' + selectedManifest.id)
                            }}
                        >
                            {t('copyURL')}
                        </Button>
                        <Button
                            color="error"
                            variant="contained"
                            onClick={() => {
                                navigate('/')
                                props.setCollection((c) => c.filter((id) => id !== selectedManifest.id))
                                setSelectedManifest(null)
                            }}
                        >
                            {t('removeFromCollection')}
                        </Button>
                    </Box>
                )}
            </Drawer>
        </>
    )
}
