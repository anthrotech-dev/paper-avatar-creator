import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Texture, CanvasTexture, TextureLoader, SRGBColorSpace } from 'three'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import { TexturePreview } from './TexturePreview'
import { Box, Button, Slider, Typography } from '@mui/material'

import { handleExport, handleResoniteExport } from './util'
import { Painter } from './Painer'

import Konva from 'konva'
import { type AvatarParams, type TextureKind } from './types'
import { useKonvaTexture } from './useKonvaTexture'
import { Avatar } from './Avatar'

function App() {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const drawingLayerRef = useRef<Konva.Layer>(null)
    const [textures, setTextures] = useState<Record<string, Texture>>({})
    const [editing, setEditing] = useState<TextureKind | null>(null)
    const [oldTexture, setOldTexture] = useState<Texture | null>(null)
    const editingTex = useKonvaTexture(drawingLayerRef, editing)

    const [headSize, setHeadSize] = useState(50)
    const [neckLength, setNeckLength] = useState(0)

    const avatarParams: AvatarParams = useMemo(
        () => ({
            headSize,
            neckLength,
            headInFront: true,
            handSize: 0.5,
            bodySize: 1,
            tailSize: 0.5,
            tailPosition: 0.5,
            tailRotation: 0,
            legsSize: 0.5,
            legsDistance: 1,
            legsDistanceFromBody: 0.5,
            legsInFront: true
        }),
        [headSize, neckLength]
    )

    const handleEdit = (textureKind: TextureKind) => {
        setEditing(textureKind)
        setOldTexture(textures[textureKind] || null)
        setTextures((prev) => ({
            ...prev,
            [textureKind]: editingTex
        }))
    }

    useEffect(() => {
        ;(async () => {
            const loader = new TextureLoader()
            const textures: Record<TextureKind, Texture> = {
                'Head-Front': await loader.loadAsync('/tex/Head-Front.png'),
                'Head-Back': await loader.loadAsync('/tex/Head-Back.png'),
                'Eyes-Closed': await loader.loadAsync('/tex/Eyes-Closed.png'),
                'Mouth-Open': await loader.loadAsync('/tex/Mouth-Open.png'),
                'Body-Front': await loader.loadAsync('/tex/Body-Front.png'),
                'Body-Back': await loader.loadAsync('/tex/Body-Back.png'),
                'Hand-Front': await loader.loadAsync('/tex/Hand-Front.png'),
                'Hand-Back': await loader.loadAsync('/tex/Hand-Back.png'),
                'Legs-Front': await loader.loadAsync('/tex/Legs-Front.png'),
                'Legs-Back': await loader.loadAsync('/tex/Legs-Back.png'),
                'Tail-Front': await loader.loadAsync('/tex/Tail-Front.png'),
                'Tail-Back': await loader.loadAsync('/tex/Tail-Back.png')
            }

            for (const key in textures) {
                textures[key as TextureKind].flipY = false
                textures[key as TextureKind].colorSpace = SRGBColorSpace
            }

            setTextures(textures)
        })()
    }, [])

    return (
        <Box
            sx={{
                width: '100vw',
                height: '100dvh',
                position: 'relative'
            }}
        >
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple={true}
                onChange={(e) => {
                    for (const file of e.target.files || []) {
                        const url = URL.createObjectURL(file)
                        const name = file.name.split('.')[0]

                        if (!(name in textures)) {
                            continue
                        }

                        const loader = new TextureLoader()
                        loader.load(url, (texture) => {
                            texture.flipY = false
                            texture.colorSpace = SRGBColorSpace
                            setTextures((prev) => ({
                                ...prev,
                                [name]: texture
                            }))
                        })
                    }
                }}
            />

            <Canvas
                style={{
                    width: '100vw',
                    height: '100dvh',
                    position: 'absolute',
                    top: 0,
                    left: 0
                }}
                camera={{ position: [0, 1, 3], fov: 50 }}
            >
                <ambientLight intensity={1} />
                <directionalLight position={[2, 2, 2]} intensity={1} />
                <Suspense fallback={null}>
                    <Avatar params={avatarParams} editing={editing} textures={textures} />
                </Suspense>
                <OrbitControls />
            </Canvas>

            <Box
                sx={{
                    width: '40vw',
                    minWidth: '700px',
                    height: 'calc(100dvh - 20px)',
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    borderRadius: '10px',
                    zIndex: 1,
                    color: 'white',
                    padding: '20px',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                }}
            >
                {editing ? (
                    <>
                        <h2>Edit Texture: {editing}</h2>

                        <Painter
                            size={512}
                            initialTexture={oldTexture}
                            drawingLayerRef={drawingLayerRef}
                            references={textures}
                        />

                        <Box display="flex" gap="10px">
                            <Button
                                variant="contained"
                                onClick={() => {
                                    if (fileInputRef.current) {
                                        fileInputRef.current.click()
                                    }
                                }}
                            >
                                Load
                            </Button>

                            <Button
                                variant="contained"
                                onClick={() => {
                                    if (!editing) return
                                    const canvas = editingTex.image as HTMLCanvasElement
                                    const tmp = document.createElement('canvas')
                                    tmp.width = canvas.width
                                    tmp.height = canvas.height
                                    const ctx = tmp.getContext('2d')
                                    if (!ctx) return
                                    ctx.drawImage(canvas, 0, 0)

                                    const editedTexture = new CanvasTexture(tmp)
                                    editedTexture.flipY = false
                                    editedTexture.colorSpace = SRGBColorSpace

                                    setTextures((prev) => ({
                                        ...prev,
                                        [editing]: editedTexture
                                    }))

                                    setEditing(null)
                                }}
                            >
                                Done
                            </Button>
                        </Box>
                    </>
                ) : (
                    <>
                        <h2>Avatar Editor</h2>
                        <h3>Head</h3>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '10px'
                            }}
                        >
                            <div>
                                <h4>Front</h4>
                                <TexturePreview
                                    texture={textures['Head-Front']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Head-Front')}
                                />
                            </div>
                            <div>
                                <h4>Back</h4>
                                <TexturePreview
                                    texture={textures['Head-Back']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Head-Back')}
                                />
                            </div>
                            <div>
                                <h4>Eyes Closed</h4>
                                <TexturePreview
                                    texture={textures['Eyes-Closed']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Eyes-Closed')}
                                />
                            </div>
                            <div>
                                <h4>Mouth Open</h4>
                                <TexturePreview
                                    texture={textures['Mouth-Open']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Mouth-Open')}
                                />
                            </div>
                        </div>
                        <Box>
                            <Typography variant="h6">Head Size</Typography>
                            <Slider
                                value={headSize}
                                min={-20}
                                max={20}
                                step={0.01}
                                onChange={(_e, newValue) => setHeadSize(newValue as number)}
                                sx={{ width: '200px', padding: '20px' }}
                            />
                            <Typography variant="h6">Neck Length</Typography>
                            <Slider
                                value={neckLength}
                                min={-10}
                                max={10}
                                step={0.01}
                                onChange={(_e, newValue) => setNeckLength(newValue as number)}
                                sx={{ width: '200px', padding: '20px' }}
                            />
                        </Box>
                        <h3>Body</h3>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '10px'
                            }}
                        >
                            <div>
                                <h4>Front</h4>
                                <TexturePreview
                                    texture={textures['Body-Front']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Body-Front')}
                                />
                            </div>
                            <div>
                                <h4>Back</h4>
                                <TexturePreview
                                    texture={textures['Body-Back']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Body-Back')}
                                />
                            </div>
                        </div>
                        <h3>Hands</h3>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '10px'
                            }}
                        >
                            <div>
                                <h4>Front</h4>
                                <TexturePreview
                                    texture={textures['Hand-Front']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Hand-Front')}
                                />
                            </div>
                            <div>
                                <h4>Back</h4>
                                <TexturePreview
                                    texture={textures['Hand-Back']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Hand-Back')}
                                />
                            </div>
                        </div>
                        <h3>Legs</h3>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '10px'
                            }}
                        >
                            <div>
                                <h4>Front</h4>
                                <TexturePreview
                                    texture={textures['Legs-Front']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Legs-Front')}
                                />
                            </div>
                            <div>
                                <h4>Back</h4>
                                <TexturePreview
                                    texture={textures['Legs-Back']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Legs-Back')}
                                />
                            </div>
                        </div>
                        <h3>Tail</h3>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '10px'
                            }}
                        >
                            <div>
                                <h4>Front</h4>
                                <TexturePreview
                                    texture={textures['Tail-Front']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Tail-Front')}
                                />
                            </div>
                            <div>
                                <h4>Back</h4>
                                <TexturePreview
                                    texture={textures['Tail-Back']}
                                    sx={{ width: '100px', height: '100px' }}
                                    onClick={() => handleEdit('Tail-Back')}
                                />
                            </div>
                        </div>
                        <Box display="flex" gap="10px">
                            <Button
                                variant="contained"
                                onClick={() => {
                                    if (fileInputRef.current) {
                                        fileInputRef.current.click()
                                    }
                                }}
                            >
                                Load Images
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => {
                                    handleExport(textures)
                                }}
                            >
                                Export Textures
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => {
                                    handleResoniteExport(textures)
                                }}
                            >
                                Export Resonite
                            </Button>
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    )
}

export default App
