import { Editor } from './scenes/Editor'
import { Plaza } from './scenes/Plaza'
import { Box } from '@mui/material'
import { OrbitControls, shaderMaterial } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Canvas, extend } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Camera, Vector3 } from 'three'
import { Drawer } from './ui/Drawer'
import { useParams } from 'react-router-dom'
import { Preview } from './scenes/Preview'
import { usePersistent } from './usePersistent'

const defaultCollection = ['5sn4vqpg9yame7n806cajt10nc']

const Skybox = shaderMaterial(
    {
        topColor: [0.1, 0.1, 0.4],
        middleColor: [1.0, 1.0, 1.0],
        bottomColor: [1.0, 1.0, 1.0],
        offset: 15,
        exponent: 0.6
    },
    // vertex shader
    `
    varying vec3 vWorldPos;
    void main(){
      vec4 wp = modelMatrix * vec4(position,1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
    // fragment shader
    `
    uniform vec3 topColor;
    uniform vec3 middleColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPos;
    void main(){
        float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
        float t = pow(clamp(h, 0.0, 1.0), exponent);

        vec3 col;
        if (t < 0.5) {
            float f = t / 0.5;
            col = mix(bottomColor, middleColor, f);
        } else {
            float f = (t - 0.5) / 0.5;
            col = mix(middleColor, topColor, f);
        }

        gl_FragColor = vec4(col, 1.0);
    }
  `
)

extend({ Skybox })

function App() {
    const [mode, setMode] = useState<'edit' | 'plaza'>('plaza')
    const [camera, setCamera] = useState<Camera>()
    const orbitRef = useRef<OrbitControlsImpl>(null)

    const { id } = useParams()
    const [collection, setCollection] = usePersistent('collection', defaultCollection)

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

    useEffect(() => {
        if (
            id ||
            collection.length !== defaultCollection.length ||
            !collection.every((e) => defaultCollection.includes(e))
        )
            return
        setMode('edit')
        setView(new Vector3(0, 10.5, 3), new Vector3(0, 10.5, 0), 1)
    }, [!orbitRef.current || !camera])

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
                            <ambientLight intensity={2} />
                            <Plaza.Scene avatars={collection} setView={setView} />
                            {mode === 'edit' && <Editor.Scene />}
                            <OrbitControls ref={orbitRef} />
                            <Preview.Scene />
                            <mesh>
                                <sphereGeometry args={[100, 32, 32]} />
                                <skybox side={2} />
                            </mesh>
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
