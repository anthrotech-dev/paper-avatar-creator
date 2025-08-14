import { createContext, Suspense, useContext, useState } from 'react'
import { Object3D, Vector3 } from 'three'

import { Avatar } from '../components/Avatar'
import { Wanderer } from '../components/Wanderer'
import { FollowCamera } from '../components/FollowCamera'
import { Box, Divider, Fab, Typography } from '@mui/material'
import { MdAdd } from 'react-icons/md'
import { type AvatarManifest } from '../types'
import { Drawer } from '../ui/Drawer'

const avatars = ['40k4v47xgajk495506caht1p5r', 'k6c06jrgz3bx77g206cajerj6c', 'antwew8bg3n517b906cajfqkcc']

type PlazaState = {
    selectedManifest: AvatarManifest | null
    setSelectedManifest: (manifest: AvatarManifest | null) => void
}

const PlazaContext = createContext<PlazaState | null>(null)

const usePlaza = () => {
    const ctx = useContext(PlazaContext)
    if (!ctx) {
        throw new Error('usePlaza must be used within a PlazaProvider')
    }
    return ctx
}

export function Plaza({ children }: { children?: React.ReactNode }) {
    const [selectedManifest, setSelectedManifest] = useState<AvatarManifest | null>(null)

    return <PlazaContext.Provider value={{ selectedManifest, setSelectedManifest }}>{children}</PlazaContext.Provider>
}

Plaza.Scene = () => {
    const { setSelectedManifest } = usePlaza()
    const [selected, setSelected] = useState<Object3D | null>(null)

    return (
        <>
            <group>
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    onPointerDown={(e) => {
                        e.stopPropagation()
                        setSelected(null)
                        setSelectedManifest(null)
                    }}
                >
                    <planeGeometry args={[200, 200]} />
                    <meshStandardMaterial color="#3a3a3a" roughness={1} metalness={0} />
                </mesh>

                <gridHelper args={[200, 200, 0x888888, 0x444444]} position={[0, 0.001, 0]} />
            </group>

            {avatars.map((id) => (
                <Wanderer key={id} initial={[0, 0, 0]} bounds={5} baseSpeed={0.5}>
                    <Suspense fallback={null}>
                        <Avatar
                            id={id}
                            onClick={(e) => {
                                setSelected(e.target)
                                setSelectedManifest(e.manifest)
                            }}
                        />
                    </Suspense>
                </Wanderer>
            ))}
            <FollowCamera target={selected} />
        </>
    )
}

Plaza.Overlay = (props: {
    setView: (position: Vector3, lookAt: Vector3, speed: number) => void
    setMode: (mode: 'edit' | 'plaza') => void
}) => {
    const { selectedManifest } = usePlaza()

    return (
        <>
            <Fab
                color="primary"
                sx={{
                    position: 'absolute',
                    bottom: '2rem',
                    right: '2rem',
                    zIndex: 1000
                }}
                onClick={() => {
                    props.setMode('edit')
                    props.setView(new Vector3(0, 10.5, 3), new Vector3(0, 10.5, 0), 1)
                }}
            >
                <MdAdd style={{ width: '2rem', height: '2rem', color: 'white' }} />
            </Fab>
            <Drawer open={!!selectedManifest}>
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
                        <Divider />
                        <Typography>{selectedManifest.description}</Typography>
                    </Box>
                )}
            </Drawer>
        </>
    )
}
