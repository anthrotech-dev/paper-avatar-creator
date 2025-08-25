import {
    createContext,
    memo,
    Suspense,
    useContext,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type RefObject,
    type SetStateAction
} from 'react'
import { RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'

import { Avatar, type AvatarInfo } from '../components/Avatar'
import { Wanderer } from '../components/Wanderer'
import { FollowCamera } from '../components/FollowCamera'
import { Alert, Box, Button, Divider, Fab, IconButton, Link, Typography } from '@mui/material'
import { MdAdd } from 'react-icons/md'
import { Drawer } from '../ui/Drawer'
import { handleExport, handleResoniteExport } from '../util'
import { useEditor } from './Editor'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import { useNavigate, Link as NavLink } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { CfmRenderer } from '../ui/CfmRenderer'
import { useTranslation } from 'react-i18next'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { TfiShiftLeftAlt } from 'react-icons/tfi'
import { TfiShiftRightAlt } from 'react-icons/tfi'
import { IoIosCloseCircleOutline } from 'react-icons/io'

type PlazaState = {
    avatarDict: Record<string, AvatarInfo>
    setAvatarDict: Dispatch<SetStateAction<Record<string, AvatarInfo>>>
}

const PlazaContext = createContext<PlazaState | null>(null)

const usePlaza = () => {
    const ctx = useContext(PlazaContext)
    if (!ctx) {
        return {
            avatarDict: {},
            setAvatarDict: () => {}
        }
    }
    return ctx
}

export function Plaza({ children }: { children?: React.ReactNode }) {
    const [avatarDict, setAvatarDict] = useState<Record<string, AvatarInfo>>({})

    return (
        <PlazaContext.Provider
            value={{
                avatarDict,
                setAvatarDict
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

Plaza.Scene = (props: { orbitRef: RefObject<OrbitControlsImpl | null>; avatars: string[] }) => {
    const { avatarDict, setAvatarDict } = usePlaza()

    const texture = useMemo(() => {
        const textureLoader = new TextureLoader()
        const texture = textureLoader.load('/tex/tile.png')
        texture.colorSpace = SRGBColorSpace
        texture.wrapS = RepeatWrapping
        texture.wrapT = RepeatWrapping
        return texture
    }, [])

    const pageID = location.pathname.slice(1)
    const selected = useMemo(() => {
        return avatarDict[pageID] || null
    }, [pageID, avatarDict])

    return (
        <>
            <group>
                <mesh position={[0, -0.005, 0]}>
                    <cylinderGeometry args={[20.0, 20.0, 0.01, 32]} />
                    {/* @ts-ignore */}
                    <fadingFloorMaterial fadeRadius={20} map={texture} />
                </mesh>
                <AvatarsRenderer avatars={props.avatars} setAvatarDict={setAvatarDict} />
            </group>
            <FollowCamera target={selected?.target} orbitRef={props.orbitRef} />
        </>
    )
}

const AvatarsRenderer = memo(
    ({
        avatars,
        setAvatarDict
    }: {
        avatars: string[]
        setAvatarDict: Dispatch<SetStateAction<Record<string, AvatarInfo>>>
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
                                navigateOnClick
                                onLoad={(avatarInfo) => {
                                    setAvatarDict((dict) => ({ ...dict, [id]: avatarInfo }))
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
    const { avatarDict, setAvatarDict } = usePlaza()
    const { setTexture, setParent, setAvatarParams } = useEditor()
    const navigate = useNavigate()

    const { t } = useTranslation('')
    const [forceDrawerClose, setForceDrawerClose] = useState(false)

    const pageID = location.pathname.slice(1) // Remove leading '/'
    const selected = useMemo<AvatarInfo | null>(() => {
        return avatarDict[pageID] || null
    }, [pageID, avatarDict])

    useEffect(() => {
        setForceDrawerClose(false)
    }, [selected])

    // press escape to exit
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                navigate('/')
            }
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [navigate])

    return (
        <>
            {selected?.manifest && (
                <Helmet>
                    <title>
                        {t('title')} | {selected.manifest.name}
                    </title>
                    <meta name="description" content={selected.manifest.description} />
                </Helmet>
            )}
            {selected?.manifest ? (
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
            <Drawer open={!!selected?.manifest && !forceDrawerClose} onClose={() => navigate('/')}>
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem'
                    }}
                >
                    <IoIosCloseCircleOutline
                        style={{
                            width: '2rem',
                            height: '2rem',
                            color: 'black'
                        }}
                        onClick={() => {
                            navigate('/')
                        }}
                    />
                </IconButton>
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
                {selected?.manifest && (
                    <Box
                        sx={{
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}
                    >
                        <Typography variant="h2">{selected.manifest.name}</Typography>
                        <Typography>Creator: {selected.manifest.creator}</Typography>
                        {selected.manifest.creatorID === props.deviceID && (
                            <Alert severity="success">{t('yourcreation')}</Alert>
                        )}
                        {selected.manifest.extends && (
                            <Link component={NavLink} to={'/' + selected.manifest.extends}>
                                {t('extends')}
                            </Link>
                        )}
                        <Divider />
                        {selected.manifest.description && <CfmRenderer message={selected.manifest.description} />}
                        <Box flex={1} />
                        <Button
                            variant="contained"
                            disabled={!selected.manifest.exportable && selected.manifest.creatorID !== props.deviceID}
                            onClick={() => {
                                if (!selected.texture) {
                                    console.error('No texture available for export')
                                    return
                                }
                                handleResoniteExport(selected.manifest, selected.texture)
                            }}
                        >
                            {t('exportResonite')}
                        </Button>
                        {selected.manifest.creatorID === props.deviceID && (
                            <Button
                                variant="contained"
                                onClick={() => {
                                    if (!selected.texture) {
                                        return
                                    }
                                    handleExport(selected.manifest, selected.texture)
                                }}
                            >
                                {t('exportZip')}
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            disabled={!selected.manifest.editable && selected.manifest.creatorID !== props.deviceID}
                            onClick={() => {
                                if (selected.texture) setTexture(selected.texture)
                                setParent(selected.manifest)
                                setAvatarParams(selected.manifest.params)
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
${location.origin}/${selected.manifest.id}`
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
                                navigator.clipboard.writeText(location.origin + '/' + selected.manifest.id)
                            }}
                        >
                            {t('copyURL')}
                        </Button>
                        <Button
                            color="error"
                            variant="contained"
                            onClick={() => {
                                setAvatarDict((dict) => {
                                    const newDict = { ...dict }
                                    delete newDict[selected.manifest.id]
                                    return newDict
                                })
                                props.setCollection((c) => c.filter((id) => id !== selected.manifest.id))
                                navigate('/')
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
