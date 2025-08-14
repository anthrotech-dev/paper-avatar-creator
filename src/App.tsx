import { Editor } from './pages/Editor'
import { Plaza } from './pages/Plaza'
import { Box } from '@mui/material'
import { OrbitControls } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Canvas } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Camera, Vector3 } from 'three'
import { Drawer } from './ui/Drawer'

function App() {
    const [mode, setMode] = useState<'edit' | 'plaza'>('plaza')
    const [camera, setCamera] = useState<Camera>()
    const orbitRef = useRef<OrbitControlsImpl>(null)

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
                        <Plaza.Scene />
                        {mode === 'edit' && <Editor.Scene />}
                        <OrbitControls ref={orbitRef} />
                    </Canvas>

                    {mode === 'plaza' && <Plaza.Overlay setMode={setMode} setView={setView} />}

                    <Drawer open={mode === 'edit'}>
                        <Editor.Overlay setMode={setMode} setView={setView} />
                    </Drawer>
                </Plaza>
            </Editor>
        </Box>
    )
}

export default App
