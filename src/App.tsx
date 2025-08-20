import { Editor } from './scenes/Editor'
import { Plaza } from './scenes/Plaza'
import { Box, useMediaQuery, useTheme } from '@mui/material'
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

const defaultCollection = ['5sn4vqpg9yame7n806cajt10nc']

function App() {
    const { t } = useTranslation('')

    const [camera, setCamera] = useState<PerspectiveCamera>()
    const orbitRef = useRef<OrbitControlsImpl>(null)

    const { id } = useParams()
    const [collection, setCollection] = usePersistent('collection', defaultCollection)

    const theme = useTheme()
    const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))

    const previewId = id ?? ''

    const mode = id === 'edit' ? 'edit' : 'plaza'

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

    useEffect(() => {
        if (
            id ||
            collection.length !== defaultCollection.length ||
            !collection.every((e) => defaultCollection.includes(e))
        )
            return
        setView(new Vector3(0, 10.5, 3), new Vector3(0, 10.5, 0), 1)
    }, [!orbitRef.current || !camera])

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
                                <Plaza.Scene avatars={collection} setView={setView} />
                                {mode === 'edit' && <Editor.Scene />}
                                <OrbitControls ref={orbitRef} maxDistance={20} />
                                <Preview.Scene />
                                <Skybox />
                            </Canvas>

                            {mode === 'plaza' && <Plaza.Overlay setCollection={setCollection} />}
                            <Preview.Overlay collection={collection} setCollection={setCollection} />

                            <Drawer open={mode === 'edit'}>
                                <Editor.Overlay setCollection={setCollection} />
                            </Drawer>
                        </Plaza>
                    </Editor>
                </Preview>
            </Box>
        </>
    )
}

export default App
