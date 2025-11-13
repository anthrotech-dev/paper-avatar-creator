import { Canvas } from '@react-three/fiber'
import { useParams } from 'react-router-dom'
import { StreamAvatar } from './components/StreamAvatar'
import { OrbitControls } from '@react-three/drei'

function ObsApp() {
    const { id } = useParams()

    return (
        <>
            <Canvas
                style={{
                    width: '100vw',
                    height: '100dvh',
                    position: 'absolute',
                    top: 0,
                    left: 0
                }}
                camera={{
                    position: [0, 2, 5],
                    fov: 10
                }}
            >
                {id && <StreamAvatar id={id} />}
                <OrbitControls target={[0, 0.5, 0]} maxDistance={20} />
            </Canvas>
        </>
    )
}

export default ObsApp
