import {
    createContext,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction
} from 'react'
import { Texture, CanvasTexture, TextureLoader, SRGBColorSpace, Vector3 } from 'three'

import { TexturePreview } from '../ui/TexturePreview'
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    FormGroup,
    Slider,
    Tab,
    Tabs,
    TextField,
    Typography
} from '@mui/material'

import { handleExport, handlePublish, handleResoniteExport } from '../util'
import { Painter } from '../ui/Painer'

import Konva from 'konva'
import { type AvatarManifest, type AvatarParams, type TextureKind } from '../types'
import { useKonvaTexture } from '../useKonvaTexture'
import { EditableAvatar } from '../components/EditableAvatar'

type EditorState = {
    init: () => Promise<void>
    parent: AvatarManifest | null
    setParent: Dispatch<SetStateAction<AvatarManifest | null>>
    textures: Record<TextureKind, Texture>
    editing: TextureKind | null
    avatarParams: AvatarParams
    setTextures: Dispatch<SetStateAction<Record<TextureKind, Texture>>>
    setEditing: Dispatch<SetStateAction<TextureKind | null>>
    setAvatarParams: Dispatch<SetStateAction<AvatarParams>>
}

const EditorContext = createContext<EditorState | null>(null)

export const useEditor = () => {
    const ctx = useContext(EditorContext)
    if (!ctx) {
        return {
            init: async () => {},
            parent: null,
            setParent: () => {},
            textures: {},
            editing: null,
            avatarParams: {
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
            },
            setTextures: () => {},
            setEditing: () => {},
            setAvatarParams: () => {}
        }
    }
    return ctx
}

export function Editor({ children }: { children?: React.ReactNode }) {
    const [parent, setParent] = useState<AvatarManifest | null>(null)
    const [textures, setTextures] = useState<Record<string, Texture>>({})
    const [editing, setEditing] = useState<TextureKind | null>(null)

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

    const init = useCallback(async () => {
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
        setParent(null)
        setEditing(null)
        setAvatarParams({
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
    }, [])

    useEffect(() => {
        init()
    }, [])

    return (
        <EditorContext.Provider
            value={{
                init,
                textures,
                editing,
                avatarParams,
                setTextures,
                setEditing,
                setAvatarParams,
                parent,
                setParent
            }}
        >
            {children}
        </EditorContext.Provider>
    )
}

Editor.Scene = () => {
    const { avatarParams, editing, textures } = useEditor()
    return (
        <group position={[0, 10, 0]}>
            <mesh>
                <cylinderGeometry args={[0.45, 0.45, 0.1, 32]} />
                <meshBasicMaterial color="black" transparent opacity={0.65} depthWrite={false} toneMapped={false} />
            </mesh>
            <Suspense fallback={null}>
                <EditableAvatar params={avatarParams} editing={editing} textures={textures} />
            </Suspense>
        </group>
    )
}

Editor.Overlay = (props: {
    setView: (position: Vector3, lookAt: Vector3, speed: number) => void
    setMode: (mode: 'edit' | 'plaza') => void
    setCollection: Dispatch<SetStateAction<string[]>>
}) => {
    const { init, parent, textures, editing, setEditing, setTextures, avatarParams, setAvatarParams } = useEditor()

    const handleEdit = (textureKind: TextureKind) => {
        setEditing(textureKind)
        setOldTexture(textures[textureKind] || null)
        setTextures((prev) => ({
            ...prev,
            [textureKind]: editingTex
        }))
    }

    const drawingLayerRef = useRef<Konva.Layer>(null)
    const editingTex = useKonvaTexture(drawingLayerRef, editing)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [oldTexture, setOldTexture] = useState<Texture | null>(null)

    const [manifest, setManifest] = useState<Partial<AvatarManifest>>({})
    const [tab, setTab] = useState<'info' | 'head' | 'body' | 'hand' | 'legs' | 'tail'>('head')

    const [open, setOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploaded, setUploaded] = useState<AvatarManifest | null>(null)

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
                    padding: 2,
                    display: 'flex',
                    flexDirection: 'column'
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
                        <Tabs
                            value={tab}
                            onChange={(_e, newValue) =>
                                setTab(newValue as 'info' | 'head' | 'body' | 'hand' | 'legs' | 'tail')
                            }
                            sx={{ marginBottom: '20px', color: 'white' }}
                        >
                            <Tab label={'プロフィール' + (manifest.name ? '' : '*')} value="info" />
                            <Tab label="あたま" value="head" />
                            <Tab label="からだ" value="body" />
                            <Tab label="て" value="hand" />
                            <Tab label="あし" value="legs" />
                            <Tab label="しっぽ" value="tail" />
                        </Tabs>

                        {tab === 'info' && (
                            <>
                                <TextField
                                    required
                                    label="名前"
                                    variant="outlined"
                                    value={manifest.name || ''}
                                    onChange={(e) => setManifest((prev) => ({ ...prev, name: e.target.value }))}
                                    sx={{ marginBottom: '20px' }}
                                />
                                <TextField
                                    label="説明"
                                    variant="outlined"
                                    value={manifest.description || ''}
                                    onChange={(e) => setManifest((prev) => ({ ...prev, description: e.target.value }))}
                                    multiline
                                    rows={4}
                                    sx={{ marginBottom: '20px' }}
                                />
                            </>
                        )}

                        {tab === 'head' && (
                            <>
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

                                    <FormGroup>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={avatarParams.headInFront ?? true}
                                                    onChange={(e) =>
                                                        setAvatarParams((prev) => ({
                                                            ...prev,
                                                            headInFront: e.target.checked
                                                        }))
                                                    }
                                                />
                                            }
                                            label="あたまを体の前に出す"
                                        />
                                    </FormGroup>
                                </Box>
                            </>
                        )}
                        {tab === 'body' && (
                            <>
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
                            </>
                        )}
                        {tab === 'hand' && (
                            <>
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
                            </>
                        )}
                        {tab === 'legs' && (
                            <>
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
                                    <FormGroup>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={avatarParams.legsInFront}
                                                    onChange={(e) =>
                                                        setAvatarParams((prev) => ({
                                                            ...prev,
                                                            legsInFront: e.target.checked
                                                        }))
                                                    }
                                                />
                                            }
                                            label="足を体の前に出す"
                                        />
                                    </FormGroup>
                                </Box>
                            </>
                        )}
                        {tab === 'tail' && (
                            <>
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
                            </>
                        )}
                        <Divider />
                        <Box display="flex" gap="10px">
                            <Button
                                variant="contained"
                                color="secondary"
                                onClick={() => {
                                    init()
                                    props.setMode('plaza')
                                    props.setView(new Vector3(-2, 2, 10), new Vector3(0, 0, 0), 1)
                                }}
                            >
                                キャンセル
                            </Button>

                            <Button
                                variant="contained"
                                onClick={() => {
                                    if (fileInputRef.current) {
                                        fileInputRef.current.click()
                                    }
                                }}
                            >
                                ロード
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => {
                                    handleExport(
                                        {
                                            ...manifest,
                                            extends: parent?.id,
                                            params: avatarParams
                                        },
                                        textures
                                    )
                                }}
                            >
                                エクスポート
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => {
                                    handleResoniteExport(textures)
                                }}
                            >
                                Resonite用に書き出し
                            </Button>
                            <Button
                                variant="contained"
                                disabled={!manifest.name}
                                onClick={() => {
                                    setOpen(true)
                                }}
                            >
                                公開
                            </Button>
                        </Box>
                    </>
                )}
            </Box>

            <Dialog open={open} onClose={() => setOpen(false)}>
                {uploaded ? (
                    <>
                        <DialogTitle>公開完了</DialogTitle>
                        <DialogContent>
                            アバターの公開が完了しました！
                            <Button
                                onClick={() => {
                                    navigator.clipboard.writeText(location.origin + '#' + uploaded.id)
                                }}
                            >
                                URLをコピー
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    window.open(
                                        `https://x.com/intent/tweet?text=${encodeURIComponent(
                                            `${location.origin}/${uploaded.id}`
                                        )}`
                                    )
                                }}
                            >
                                Xでシェア
                            </Button>
                        </DialogContent>
                        <DialogActions>
                            <Button
                                onClick={() => {
                                    setOpen(false)
                                }}
                            >
                                閉じる
                            </Button>
                        </DialogActions>
                    </>
                ) : (
                    <>
                        <DialogTitle>投稿: {manifest.name}</DialogTitle>
                        <DialogContent>
                            あなたのアバターを公開します。
                            <TextField
                                label="クリエイター名"
                                variant="outlined"
                                required
                                value={manifest.creator || ''}
                                onChange={(e) => setManifest((prev) => ({ ...prev, creator: e.target.value }))}
                                fullWidth
                                sx={{ marginBottom: '20px' }}
                            />
                            <FormGroup>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={manifest.editable || false}
                                            onChange={(e) =>
                                                setManifest((prev) => ({ ...prev, editable: e.target.checked }))
                                            }
                                        />
                                    }
                                    label="アバター出力を許可"
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={manifest.exportable || false}
                                            onChange={(e) =>
                                                setManifest((prev) => ({ ...prev, exportable: e.target.checked }))
                                            }
                                        />
                                    }
                                    label="改変を許可"
                                />
                            </FormGroup>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setOpen(false)}>キャンセル</Button>
                            <Button
                                variant="contained"
                                disabled={uploading || !manifest.creator}
                                onClick={() => {
                                    setUploading(true)
                                    handlePublish(
                                        {
                                            ...manifest,
                                            extends: parent?.id,
                                            params: avatarParams
                                        },
                                        textures
                                    )
                                        .then((data) => {
                                            console.log('Published successfully:', data)
                                            props.setCollection((prev) => [...prev, data.id])
                                            setUploaded(data)
                                        })
                                        .finally(() => {
                                            setUploading(false)
                                        })
                                }}
                            >
                                {uploading ? '送信中...' : '公開'}
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </>
    )
}
