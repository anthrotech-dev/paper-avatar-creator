import {
    createContext,
    Suspense,
    useContext,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type RefObject,
    type SetStateAction
} from 'react'
import { Texture, CanvasTexture, TextureLoader, SRGBColorSpace } from 'three'

import { TexturePreview } from '../ui/TexturePreview'
import { Box, Button, Slider, Typography } from '@mui/material'

import { handleExport, handleResoniteExport } from '../util'
import { Painter } from '../ui/Painer'

import Konva from 'konva'
import { type AvatarParams, type TextureKind } from '../types'
import { useKonvaTexture } from '../useKonvaTexture'
import { Avatar } from '../components/Avatar'

type EditorState = {
    textures: Record<TextureKind, Texture>
    editing: TextureKind | null
    oldTexture: Texture | null
    avatarParams: AvatarParams
    setTextures: Dispatch<SetStateAction<Record<TextureKind, Texture>>>
    setEditing: Dispatch<SetStateAction<TextureKind | null>>
    setOldTexture: Dispatch<SetStateAction<Texture | null>>
    setAvatarParams: Dispatch<SetStateAction<AvatarParams>>
    fileInputRef: RefObject<HTMLInputElement | null>
    drawingLayerRef: RefObject<Konva.Layer | null>
    handleEdit: (textureKind: TextureKind) => void
    editingTex: CanvasTexture
}

const EditorContext = createContext<EditorState | null>(null)

const useEditor = () => {
    const ctx = useContext(EditorContext)
    if (!ctx) {
        throw new Error('useEditor must be used within an EditorProvider')
    }
    return ctx
}

export function Editor({ children }: { children?: React.ReactNode }) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const drawingLayerRef = useRef<Konva.Layer>(null)
    const [textures, setTextures] = useState<Record<string, Texture>>({})
    const [editing, setEditing] = useState<TextureKind | null>(null)
    const [oldTexture, setOldTexture] = useState<Texture | null>(null)
    const editingTex = useKonvaTexture(drawingLayerRef, editing)

    const [avatarParams, setAvatarParams] = useState<AvatarParams>({
        headSize: 0,
        neckLength: 0,
        headInFront: true,
        handSize: 0,
        bodySize: 0,
        tailSize: 0,
        tailPosition: 0,
        tailRotation: 0,
        legsSize: 0,
        legsDistance: 0,
        legsDistanceFromBody: 0,
        legsInFront: true
    })

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
        <EditorContext.Provider
            value={{
                textures,
                editing,
                oldTexture,
                fileInputRef,
                drawingLayerRef,
                avatarParams,
                editingTex,
                setTextures,
                setEditing,
                setOldTexture,
                setAvatarParams,
                handleEdit
            }}
        >
            {children}
        </EditorContext.Provider>
    )
}

Editor.Scene = () => {
    const { avatarParams, editing, textures } = useEditor()
    return (
        <>
            <Suspense fallback={null}>
                <Avatar params={avatarParams} editing={editing} textures={textures} />
            </Suspense>
        </>
    )
}

Editor.Overlay = () => {
    const {
        textures,
        editing,
        setEditing,
        oldTexture,
        setTextures,
        fileInputRef,
        drawingLayerRef,
        avatarParams,
        setAvatarParams,
        handleEdit,
        editingTex
    } = useEditor()
    return (
        <>
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
                                value={avatarParams.headSize}
                                min={-20}
                                max={20}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        headSize: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                            <Typography variant="h6">Neck Length</Typography>
                            <Slider
                                value={avatarParams.neckLength}
                                min={-10}
                                max={10}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        neckLength: newValue as number
                                    }))
                                }
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
                        <Box>
                            <Typography variant="h6">Body Size</Typography>
                            <Slider
                                value={avatarParams.bodySize}
                                min={-20}
                                max={20}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        bodySize: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                        </Box>
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
                        <Box>
                            <Typography variant="h6">Hand Size</Typography>
                            <Slider
                                value={avatarParams.handSize}
                                min={-1}
                                max={1}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        handSize: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                        </Box>
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
                        <Box>
                            <Typography variant="h6">Legs Size</Typography>
                            <Slider
                                value={avatarParams.legsSize}
                                min={0.1}
                                max={2}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        legsSize: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                            <Typography variant="h6">Legs Distance</Typography>
                            <Slider
                                value={avatarParams.legsDistance}
                                min={-5}
                                max={5}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        legsDistance: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                            <Typography variant="h6">Legs Distance from Body</Typography>
                            <Slider
                                value={avatarParams.legsDistanceFromBody}
                                min={-10}
                                max={10}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        legsDistanceFromBody: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                        </Box>
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
                        <Box>
                            <Typography variant="h6">Tail Size</Typography>
                            <Slider
                                value={avatarParams.tailSize}
                                min={-20}
                                max={20}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        tailSize: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                            <Typography variant="h6">Tail Position</Typography>
                            <Slider
                                value={avatarParams.tailPosition}
                                min={-10}
                                max={10}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        tailPosition: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                            <Typography variant="h6">Tail Rotation</Typography>
                            <Slider
                                value={avatarParams.tailRotation}
                                min={0}
                                max={2 * Math.PI}
                                step={0.001}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        tailRotation: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                        </Box>
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
        </>
    )
}
