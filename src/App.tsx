import { Editor } from './pages/Editor'
import { Plaza } from './pages/Plaza'
import { Box } from '@mui/material'
import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

function App() {
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
                        camera={{ position: [0, 5, -5], fov: 25 }}
                    >
                        <ambientLight intensity={1} />
                        <directionalLight position={[2, 2, 2]} intensity={1} />
                        <Plaza.Scene />
                        <Editor.Scene />
                        <OrbitControls />
                    </Canvas>
                    <Editor.Overlay />
                    <Plaza.Overlay />
                </Plaza>
            </Editor>
        </Box>
    )
}

export default App
