import { Editor } from './scenes/Editor'
import { Plaza } from './scenes/Plaza'
import { Box, Fab, Modal, Paper, useMediaQuery, useTheme } from '@mui/material'
import { OrbitControls } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { Drawer } from './ui/Drawer'
import { useParams } from 'react-router-dom'
import { Preview } from './scenes/Preview'
import { usePersistent } from './usePersistent'
import { Skybox } from './components/Skybox'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { cdid } from './util'
import { IoHelpCircleOutline } from 'react-icons/io5'

const defaultCollection = [
    'ntngw0xw6rcmppnh06ccmvqtqr', // テンプレートくん
    'kna5gn7kjex5awnt06cchj52cc', // ととがんま
    'dp32dv0dgn8cgr5706cch6xyv0', // あむ
    'fat5f37e26tgqp9006cchnzg84', // ろくろもち
    '58e9fqqexv1xpape06cchjr7h0', // えごえごペンギン
    '6t8e8t4p5b2mw7t706ccnddhsw' // あむ with color
]

function App() {
    const { t } = useTranslation('')

    const [camera, setCamera] = useState<PerspectiveCamera>()
    const orbitRef = useRef<OrbitControlsImpl>(null)

    const { id } = useParams()
    const [collection, setCollection] = usePersistent('collection', defaultCollection)
    const [deviceID] = usePersistent('deviceID', 'U' + cdid())

    const theme = useTheme()
    const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))

    const previewId = (id ?? '') === 'edit' ? '' : (id ?? '')

    const mode = id === 'edit' ? 'edit' : 'plaza'

    const [openHelp, setOpenHelp] = useState(false)

    const setView = useCallback(
        (position: Vector3, lookAt: Vector3, duration: number) => {
            if (!orbitRef.current || !camera) return

            let dt = 0

            const animate = () => {
                dt += 0.01
                const t = Math.min(dt / duration, 1)

                camera.position.lerp(position, t)
                orbitRef.current?.target.lerp(lookAt, t)

                if (t < 1) {
                    requestAnimationFrame(animate)
                } else {
                    camera.position.set(...position.toArray())
                    if (orbitRef.current) orbitRef.current.target = new Vector3(...lookAt)
                }
            }

            animate()
        },
        [camera]
    )

    useEffect(() => {
        if (id) {
            setView(new Vector3(0, 10.5, 3), new Vector3(0, 10.5, 0), 1)
        } else {
            setView(new Vector3(-2, 2, 10), new Vector3(0, 0, 0), 1)
        }
    }, [id, setView])

    useEffect(() => {
        if (!camera) return

        const fullW = window.innerWidth
        const fullH = window.innerHeight

        let xOffset = 0
        let yOffset = 0
        if (isMobileSize) {
            yOffset = Math.round(fullH * 0.3)
        } else {
            xOffset = Math.round(fullW * 0.08)
        }

        camera.setViewOffset(fullW, fullH, xOffset, yOffset, fullW, fullH)
    }, [camera, isMobileSize])

    return (
        <>
            <Helmet>
                <title>{t('title')}</title>
            </Helmet>
            <Box
                sx={{
                    width: '100vw',
                    height: '100dvh',
                    position: 'relative'
                }}
            >
                <Fab
                    sx={{
                        position: 'absolute',
                        bottom: 'calc(3rem + 60px)',
                        right: '2rem',
                        zIndex: 1000
                    }}
                    onClick={() => {
                        setOpenHelp(true)
                    }}
                >
                    <IoHelpCircleOutline style={{ width: '2rem', height: '2rem', color: theme.palette.primary.main }} />
                </Fab>

                <Modal open={openHelp} onClose={() => setOpenHelp(false)}>
                    <Paper
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            padding: 2
                        }}
                    >
                        <iframe
                            width="560"
                            height="315"
                            src="https://www.youtube.com/embed/N-pYu789P_g?si=yF2NfZtFgj22GCO_"
                            title="YouTube video player"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                            style={{
                                border: 'none',
                                borderRadius: '8px'
                            }}
                        ></iframe>
                    </Paper>
                </Modal>
                <Preview id={previewId}>
                    <Editor>
                        <Plaza>
                            <Canvas
                                style={{
                                    width: '100vw',
                                    height: '100dvh',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0
                                }}
                                camera={{ position: [-2, 2, 10], fov: isMobileSize ? 50 : 30 }}
                                onCreated={({ camera }) => {
                                    setCamera(camera as PerspectiveCamera)
                                }}
                            >
                                <Plaza.Scene avatars={collection} orbitRef={orbitRef} />
                                {mode === 'edit' && <Editor.Scene />}
                                <OrbitControls ref={orbitRef} maxDistance={20} />
                                <Preview.Scene />
                                <Skybox />
                            </Canvas>

                            {mode === 'plaza' && (
                                <Plaza.Overlay setCollection={setCollection} deviceID={deviceID} setView={setView} />
                            )}
                            <Preview.Overlay
                                collection={collection}
                                setCollection={setCollection}
                                deviceID={deviceID}
                            />

                            <Drawer open={mode === 'edit'}>
                                <Editor.Overlay setCollection={setCollection} deviceID={deviceID} />
                            </Drawer>
                        </Plaza>
                    </Editor>
                </Preview>
            </Box>
        </>
    )
}

export default App
