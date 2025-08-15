import { Box, Button, Divider, Typography } from '@mui/material'
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AvatarManifest } from '../types'
import { Drawer } from '../ui/Drawer'
import { Avatar } from '../components/Avatar'
import { Vector3 } from 'three'
import { useNavigate } from 'react-router-dom'

interface PreviewProps {
    id: string
    setView: (position: Vector3, lookAt: Vector3, speed: number) => void
    children?: ReactNode
}

type PreviewState = {
    id: string
    manifest: AvatarManifest | null
    setManifest: (manifest: AvatarManifest | null) => void
}

const PreviewContext = createContext<PreviewState | null>(null)

const usePreview = () => {
    const ctx = useContext(PreviewContext)
    if (!ctx) {
        throw new Error('usePreview must be used within a PreviewProvider')
    }

    return ctx
}

export function Preview(props: PreviewProps) {
    const [manifest, setManifest] = useState<AvatarManifest | null>(null)

    useEffect(() => {
        if (!props.id || props.id === '') {
            setManifest(null)
            return
        }
        if (!manifest) return
        props.setView(new Vector3(0, 10.5, 3), new Vector3(0, 10.5, 0), 1)
    }, [props.id, manifest])

    return (
        <PreviewContext.Provider
            value={{
                id: props.id,
                manifest,
                setManifest
            }}
        >
            {props.children}
        </PreviewContext.Provider>
    )
}

Preview.Scene = () => {
    const { id, setManifest } = usePreview()

    if (!id || id === '') {
        return <></>
    }

    return (
        <group position={[0, 10, 0]}>
            <mesh>
                <cylinderGeometry args={[0.45, 0.45, 0.1, 32]} />
                <meshBasicMaterial color="black" transparent opacity={0.65} depthWrite={false} toneMapped={false} />
            </mesh>
            <Suspense fallback={null}>
                <Avatar
                    id={id}
                    onLoad={(manifest) => {
                        setManifest(manifest)
                    }}
                />
            </Suspense>
        </group>
    )
}

Preview.Overlay = (props: { setView: (position: Vector3, lookAt: Vector3, speed: number) => void }) => {
    const { manifest } = usePreview()
    const navigate = useNavigate()

    return (
        <Drawer open={!!manifest}>
            {manifest && (
                <>
                    <Box
                        sx={{
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}
                    >
                        <Typography variant="h2">{manifest.name}</Typography>
                        <Typography>Creator: {manifest.creator}</Typography>
                        <Divider />
                        <Typography>{manifest.description}</Typography>
                    </Box>
                    <Button
                        variant="contained"
                        color="primary"
                        sx={{ margin: '1rem' }}
                        onClick={() => {
                            props.setView(new Vector3(-2, 2, 10), new Vector3(0, 0, 0), 1)
                            navigate('/')
                        }}
                    >
                        とじる
                    </Button>
                </>
            )}
        </Drawer>
    )
}
