import {
    createContext,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type RefObject,
    type SetStateAction
} from 'react'
import { Texture, TextureLoader, SRGBColorSpace, Vector3, OrthographicCamera, WebGLRenderer, Object3D } from 'three'

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
    Modal,
    Slider,
    TextField,
    Typography
} from '@mui/material'

import { handleExport, handlePublish, handleResoniteExport } from '../util'
import { Painter } from '../ui/Painer'

import { type AvatarManifest, type AvatarParams } from '../types'
import { EditableAvatar } from '../components/EditableAvatar'

type EditorState = {
    init: () => Promise<void>
    parent: AvatarManifest | null
    setParent: Dispatch<SetStateAction<AvatarManifest | null>>
    avatarParams: AvatarParams
    setAvatarParams: Dispatch<SetStateAction<AvatarParams>>
    thumbnailCameraRef?: RefObject<OrthographicCamera | null>
    thumbSceneRef?: RefObject<Object3D | null>
    texture: Texture
}

const EditorContext = createContext<EditorState | null>(null)

export const useEditor = () => {
    const ctx = useContext(EditorContext)
    if (!ctx) {
        return {
            init: async () => {},
            parent: null,
            setParent: () => {},
            texture: new Texture(),
            avatarParams: {
                headSize: 0,
                neckLength: 0,
                headInFront: true,
                handSize: 0,
                bodySize: 0,
                disableTail: false,
                tailSize: 0,
                tailPosition: 0,
                tailRotation: 0,
                legsSize: 0,
                legsDistance: 0,
                legsDistanceFromBody: 0,
                legsInFront: true
            },
            setAvatarParams: () => {}
        }
    }
    return ctx
}

export function Editor({ children }: { children?: React.ReactNode }) {
    const thumbnailCameraRef = useRef<OrthographicCamera>(null)
    const [parent, setParent] = useState<AvatarManifest | null>(null)
    const [texture, setTexture] = useState<Texture>(new Texture())

    const thumbSceneRef = useRef<Object3D>(null)

    const [avatarParams, setAvatarParams] = useState<AvatarParams>({
        headSize: 0,
        neckLength: 0,
        headInFront: true,
        handSize: 0,
        bodySize: 0,
        disableTail: false,
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

        const texture = loader.load('/tex/template.png')
        texture.flipY = false
        texture.colorSpace = SRGBColorSpace
        setTexture(texture)

        setParent(null)
        setAvatarParams({
            headSize: 0,
            neckLength: 0,
            headInFront: true,
            handSize: 0,
            bodySize: 0,
            disableTail: false,
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
                texture,
                avatarParams,
                setAvatarParams,
                parent,
                setParent,
                thumbnailCameraRef,
                thumbSceneRef
            }}
        >
            {children}
        </EditorContext.Provider>
    )
}

const thumbnailWidth = 1280
const thumbnailHeight = 720
const thumbnailSceneWidth = 2.0
const thumbnailSceneHeight = (thumbnailHeight / thumbnailWidth) * thumbnailSceneWidth

Editor.Scene = () => {
    const { avatarParams, texture, thumbnailCameraRef, thumbSceneRef } = useEditor()

    const thumbTitleTex = useMemo(() => {
        const loader = new TextureLoader()
        const texture = loader.load('/tex/OekakiAvatar_thumbnail_title.png', (tex) => {
            tex.colorSpace = SRGBColorSpace
        })
        return texture
    }, [])

    const thumbBackgroundTex = useMemo(() => {
        const loader = new TextureLoader()
        const texture = loader.load('/tex/OekakiAvatar_thumbnail_background.png', (tex) => {
            tex.colorSpace = SRGBColorSpace
        })
        return texture
    }, [])

    return (
        <>
            <group position={[0, 10, 0]}>
                <mesh>
                    <cylinderGeometry args={[0.45, 0.45, 0.1, 32]} />
                    <meshBasicMaterial color="black" transparent opacity={0.65} depthWrite={false} toneMapped={false} />
                </mesh>
                <Suspense fallback={null}>
                    <EditableAvatar params={avatarParams} texture={texture} />
                </Suspense>
            </group>
            <group ref={thumbSceneRef} position={[0, -200, 0]}>
                <orthographicCamera
                    ref={thumbnailCameraRef}
                    position={[0, 0.55, 1.0]}
                    args={[
                        -thumbnailSceneWidth / 2,
                        thumbnailSceneWidth / 2,
                        thumbnailSceneHeight / 2,
                        -thumbnailSceneHeight / 2,
                        0.1,
                        1000
                    ]}
                    rotation={[0, 0, 0]}
                />
                <Suspense fallback={null}>
                    <EditableAvatar params={avatarParams} texture={texture} />
                </Suspense>
                <mesh position={[0, 0.55, 0.5]}>
                    <planeGeometry args={[thumbnailSceneWidth, thumbnailSceneHeight]} />
                    <meshBasicMaterial map={thumbTitleTex} transparent={true} depthWrite={false} toneMapped={false} />
                </mesh>
                <mesh position={[0, 0.55, -0.5]}>
                    <planeGeometry args={[thumbnailSceneWidth, thumbnailSceneHeight]} />
                    <meshBasicMaterial
                        map={thumbBackgroundTex}
                        transparent={true}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
            </group>
        </>
    )
}

Editor.Overlay = (props: {
    setView: (position: Vector3, lookAt: Vector3, speed: number) => void
    setMode: (mode: 'edit' | 'plaza') => void
    setCollection: Dispatch<SetStateAction<string[]>>
}) => {
    const { init, parent, texture, avatarParams, setAvatarParams, thumbnailCameraRef, thumbSceneRef } = useEditor()

    const [editing, setEditing] = useState<boolean>(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    //const [oldTexture, setOldTexture] = useState<Texture | null>(null)

    const [manifest, setManifest] = useState<Partial<AvatarManifest>>({})

    const [open, setOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploaded, setUploaded] = useState<AvatarManifest | null>(null)

    const [thumbnail, setThumbnail] = useState<string | null>(null)
    const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null)

    return (
        <>
            {/*
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
        */}
            <Box
                sx={{
                    padding: 2,
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <h2>Avatar Editor</h2>
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

                <TexturePreview
                    texture={texture}
                    sx={{ width: '100px', height: '100px', border: '1px solid #ccc' }}
                    onClick={() => setEditing(true)}
                />

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
                <Box>
                    <Typography variant="h6">Legs Size</Typography>
                    <Slider
                        value={avatarParams.legsSize}
                        min={-1}
                        max={1}
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
                <FormGroup>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={avatarParams.disableTail}
                                onChange={(e) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        disableTail: e.target.checked
                                    }))
                                }
                            />
                        }
                        label="しっぽを無効化"
                    />
                </FormGroup>
                {!avatarParams.disableTail && (
                    <>
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
                                texture
                            )
                        }}
                    >
                        エクスポート
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            handleResoniteExport(
                                {
                                    ...manifest,
                                    extends: parent?.id,
                                    params: avatarParams
                                },
                                texture
                            )
                        }}
                    >
                        Resonite用に書き出し
                    </Button>
                    <Button
                        variant="contained"
                        disabled={!manifest.name}
                        onClick={() => {
                            setOpen(true)

                            if (!thumbnailCameraRef?.current) return
                            if (!thumbSceneRef?.current) return

                            const canvas = document.createElement('canvas')
                            canvas.width = thumbnailWidth
                            canvas.height = thumbnailHeight

                            const camera = thumbnailCameraRef.current
                            camera.updateProjectionMatrix()
                            camera.updateMatrixWorld()

                            const renderer = new WebGLRenderer({ canvas })
                            renderer.setSize(thumbnailWidth, thumbnailHeight)
                            renderer.render(thumbSceneRef.current, camera)

                            const dataURL = canvas.toDataURL('image/png')
                            setThumbnail(dataURL)
                            canvas.toBlob((blob) => {
                                if (blob) {
                                    setThumbnailBlob(blob)
                                }
                            }, 'image/png')
                        }}
                    >
                        公開
                    </Button>
                </Box>
            </Box>

            <Modal
                open={!!editing}
                onClose={() => {
                    setEditing(false)
                }}
            >
                <>
                    <Painter width={2048} height={1024} />
                </>
            </Modal>

            <Dialog open={open} onClose={() => setOpen(false)}>
                {uploaded ? (
                    <>
                        <DialogTitle>公開完了</DialogTitle>
                        <DialogContent>
                            アバターの公開が完了しました！
                            <Button
                                onClick={() => {
                                    navigator.clipboard.writeText(location.origin + '/' + uploaded.id)
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
                                            `#oekakiavatar
${location.origin}/${uploaded.id}`
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
                        <DialogContent
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '20px',
                                alignItems: 'center'
                            }}
                        >
                            <Box>
                                {thumbnail && (
                                    <img
                                        src={thumbnail}
                                        alt="Thumbnail"
                                        style={{ width: '300px', height: 'auto', marginBottom: '20px' }}
                                    />
                                )}
                            </Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flex: 1,
                                    flexDirection: 'column'
                                }}
                            >
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
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setOpen(false)}>キャンセル</Button>
                            <Button
                                variant="contained"
                                disabled={uploading || !manifest.creator}
                                onClick={() => {
                                    setUploading(true)
                                    if (!thumbnailBlob) {
                                        alert('サムネイルが生成されていません。もう一度公開を試みてください。')
                                        return
                                    }
                                    handlePublish(
                                        thumbnailBlob,
                                        {
                                            ...manifest,
                                            extends: parent?.id,
                                            params: avatarParams
                                        },
                                        texture
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
