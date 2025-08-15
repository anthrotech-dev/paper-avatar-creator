import { Editor } from './scenes/Editor'
import { Plaza } from './scenes/Plaza'
import { Box } from '@mui/material'
import { OrbitControls } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Canvas } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Camera, Vector3 } from 'three'
import { Drawer } from './ui/Drawer'
import { useParams } from 'react-router-dom'
import { Preview } from './scenes/Preview'
import { usePersistent } from './usePersistent'

function App() {
    const [mode, setMode] = useState<'edit' | 'plaza'>('plaza')
    const [camera, setCamera] = useState<Camera>()
    const orbitRef = useRef<OrbitControlsImpl>(null)

    const { id } = useParams()
    const [collection, setCollection] = usePersistent('collection', ['5sn4vqpg9yame7n806cajt10nc'])

    const previewId = id ?? ''

    const setView = (position: Vector3, lookAt: Vector3, duration: number) => {
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
    }

    return (
        <Box
            sx={{
                width: '100vw',
                height: '100dvh',
                position: 'relative'
            }}
        >
            <Preview id={previewId} setView={setView}>
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
                            camera={{ position: [-2, 2, 10], fov: 30 }}
                            onCreated={({ camera }) => {
                                setCamera(camera)
                            }}
                        >
                            <ambientLight intensity={1} />
                            <directionalLight position={[2, 2, 2]} intensity={1} />
                            <Plaza.Scene avatars={collection} setView={setView} />
                            {mode === 'edit' && <Editor.Scene />}
                            <OrbitControls ref={orbitRef} />
                            <Preview.Scene />
                        </Canvas>

                        {mode === 'plaza' && (
                            <Plaza.Overlay setMode={setMode} setView={setView} setCollection={setCollection} />
                        )}
                        <Preview.Overlay setView={setView} collection={collection} setCollection={setCollection} />

                        <Drawer open={mode === 'edit'}>
                            <Editor.Overlay setMode={setMode} setView={setView} setCollection={setCollection} />
                        </Drawer>
                    </Plaza>
                </Editor>
            </Preview>
        </Box>
    )
}

export default App
