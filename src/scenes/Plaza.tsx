import { createContext, memo, Suspense, useContext, useState, type Dispatch, type SetStateAction } from 'react'
import { Object3D, Texture, Vector3 } from 'three'

import { Avatar } from '../components/Avatar'
import { Wanderer } from '../components/Wanderer'
import { FollowCamera } from '../components/FollowCamera'
import { Box, Button, Divider, Fab, Typography } from '@mui/material'
import { MdAdd } from 'react-icons/md'
import { type AvatarManifest } from '../types'
import { Drawer } from '../ui/Drawer'
import { handleResoniteExport } from '../util'

type PlazaState = {
    textures: Record<string, Texture>
    setTextures: Dispatch<SetStateAction<Record<string, Texture>>>
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
    const [textures, setTextures] = useState<Record<string, Texture>>({})

    return (
        <PlazaContext.Provider value={{ textures, selectedManifest, setTextures, setSelectedManifest }}>
            {children}
        </PlazaContext.Provider>
    )
}

Plaza.Scene = (props: { avatars: string[]; setView: (position: Vector3, lookAt: Vector3, speed: number) => void }) => {
    const { setSelectedManifest, setTextures } = usePlaza()
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
                        if (selected) {
                            props.setView(new Vector3(-2, 2, 10), new Vector3(0, 0, 0), 1)
                        }
                    }}
                >
                    <planeGeometry args={[200, 200]} />
                    <meshStandardMaterial color="#3a3a3a" roughness={1} metalness={0} />
                </mesh>
                <AvatarsRenderer
                    setTextures={setTextures}
                    avatars={props.avatars}
                    setSelectedManifest={setSelectedManifest}
                    setSelected={setSelected}
                />
                <gridHelper args={[200, 200, 0x888888, 0x444444]} position={[0, 0.001, 0]} />
            </group>
            <FollowCamera target={selected} />
        </>
    )
}

const AvatarsRenderer = memo(
    ({
        avatars,
        setSelectedManifest,
        setSelected,
        setTextures
    }: {
        avatars: string[]
        setSelectedManifest: (_: AvatarManifest | null) => void
        setSelected: (_: Object3D | null) => void
        setTextures: Dispatch<SetStateAction<Record<string, Texture>>>
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
                                onClick={(e) => {
                                    setSelected(e.target)
                                    setSelectedManifest(e.manifest)
                                    setTextures(e.textures)
                                }}
                            />
                        </Suspense>
                    </Wanderer>
                ))}
            </>
        )
    }
)

Plaza.Overlay = (props: {
    setView: (position: Vector3, lookAt: Vector3, speed: number) => void
    setMode: (mode: 'edit' | 'plaza') => void
    setCollection: Dispatch<SetStateAction<string[]>>
}) => {
    const { selectedManifest, setSelectedManifest, textures } = usePlaza()

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
                        <Box flex={1} />
                        <Button
                            variant="contained"
                            disabled={!selectedManifest.exportable}
                            onClick={() => {
                                handleResoniteExport(textures)
                            }}
                        >
                            Resonite用に書き出し
                        </Button>
                        <Button
                            color="primary"
                            variant="contained"
                            onClick={() => {
                                navigator.clipboard.writeText(location.origin + '/' + selectedManifest.id)
                            }}
                        >
                            URLをコピー
                        </Button>
                        <Button
                            color="error"
                            variant="contained"
                            onClick={() => {
                                props.setMode('plaza')
                                props.setCollection((c) => c.filter((id) => id !== selectedManifest.id))
                                setSelectedManifest(null)
                                props.setView(new Vector3(-2, 2, 10), new Vector3(0, 0, 0), 1)
                            }}
                        >
                            コレクションから削除
                        </Button>
                    </Box>
                )}
            </Drawer>
        </>
    )
}
