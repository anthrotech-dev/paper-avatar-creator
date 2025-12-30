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
import { Texture, TextureLoader, SRGBColorSpace, OrthographicCamera, WebGLRenderer, Object3D } from 'three'

import { TexturePreview } from '../ui/TexturePreview'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    FormGroup,
    Menu,
    MenuItem,
    Modal,
    Slider,
    TextField,
    Typography
} from '@mui/material'

import { handleExport, handlePublish, handleResoniteExport } from '../util'
import { Painter } from '../ui/Painer'
import JSZip from 'jszip'
import { Turnstile } from '@marsidev/react-turnstile'

import { symetricTextures, texturePositions, type AvatarManifest, type AvatarParams } from '../types'
import { EditableAvatar } from '../components/EditableAvatar'
import { useLocation, useNavigate } from 'react-router-dom'
import { ThumbnailAvatar } from '../components/ThumbnailAvatar'
import { useTranslation } from 'react-i18next'
import { FaCaretDown } from 'react-icons/fa'
import { useConfirm } from '../useConfirm'
import { FaInfoCircle } from 'react-icons/fa'

type EditorState = {
    init: () => Promise<void>
    parent: AvatarManifest | null
    setParent: Dispatch<SetStateAction<AvatarManifest | null>>
    avatarParams: AvatarParams
    setAvatarParams: Dispatch<SetStateAction<AvatarParams>>
    thumbnailCameraRef?: RefObject<OrthographicCamera | null>
    thumbSceneRef?: RefObject<Object3D | null>
    setTexture: Dispatch<SetStateAction<Texture | null>>
    texture: Texture | null
    defaultTexture: Texture
    session: number
}

const EditorContext = createContext<EditorState | null>(null)

export const useEditor = (): EditorState => {
    const ctx = useContext(EditorContext)
    if (!ctx) {
        return {
            init: async () => {},
            parent: null,
            setParent: () => {},
            texture: null,
            setTexture: () => {},
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
            setAvatarParams: () => {},
            defaultTexture: new Texture(),
            session: 0
        }
    }
    return ctx
}

export function Editor({ children }: { children?: React.ReactNode }) {
    const thumbnailCameraRef = useRef<OrthographicCamera>(null)
    const [parent, setParent] = useState<AvatarManifest | null>(null)
    const [texture, setTexture] = useState<Texture | null>(null)
    const [session, setSession] = useState<number>(0)

    const thumbSceneRef = useRef<Object3D>(null)

    const [defaultTexture, setDefaultTexture] = useState<Texture>(new Texture())

    const location = useLocation()
    const params = new URLSearchParams(location.search)
    const initTexture = params.get('init')

    useEffect(() => {
        const loader = new TextureLoader()
        loader.loadAsync('/tex/sample.png').then((tex) => {
            tex.flipY = false
            tex.colorSpace = SRGBColorSpace
            setDefaultTexture(tex)
        })
    }, [])

    useEffect(() => {
        console.log('initTexture param:', initTexture)
        if (!initTexture) return
        const loader = new TextureLoader()
        const url = `https://oekaki-avatar-files.anthrotech.dev/drawings/${initTexture}.png`
        loader.loadAsync(url).then((tex) => {
            tex.flipY = false
            tex.colorSpace = SRGBColorSpace
            setDefaultTexture(tex)
        })
    }, [initTexture])

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
        setTexture(null)
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
        setSession((prev) => prev + 1)
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
                thumbSceneRef,
                setTexture,
                defaultTexture,
                session
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
    const { avatarParams, texture, thumbnailCameraRef, thumbSceneRef, defaultTexture } = useEditor()

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
                    <EditableAvatar params={avatarParams} texture={texture ?? defaultTexture} />
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
                    <ThumbnailAvatar params={avatarParams} texture={texture ?? defaultTexture} />
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

Editor.Overlay = (props: { setCollection: Dispatch<SetStateAction<string[]>>; deviceID: string }) => {
    const {
        init,
        parent,
        texture,
        avatarParams,
        setAvatarParams,
        thumbnailCameraRef,
        thumbSceneRef,
        setTexture,
        defaultTexture,
        session
    } = useEditor()

    const { t } = useTranslation('')

    const navigate = useNavigate()

    const [editing, setEditing] = useState<boolean>(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const [manifest, setManifest] = useState<Partial<AvatarManifest>>({})

    const [open, setOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploaded, setUploaded] = useState<AvatarManifest | null>(null)

    const [thumbnail, setThumbnail] = useState<string | null>(null)
    const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null)

    const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null)

    const [showEditorHint, setShowEditorHint] = useState<boolean>(false)

    useEffect(() => {
        setManifest({})
        setThumbnail(null)
        setUploading(false)
        setUploaded(null)
        setThumbnailBlob(null)
    }, [session])

    const confirm = useConfirm()

    const [token, setToken] = useState<string | null>(null)

    return (
        <>
            <input
                type="file"
                accept="image/*,application/json,application/zip"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple={true}
                onChange={async (e) => {
                    const images: File[] = []

                    for (const file of e.target.files || []) {
                        console.log('Processing file:', file.name, file.type)
                        if (file.name === 'manifest.json') {
                            const text = await file.text()
                            try {
                                const data = JSON.parse(text) as AvatarManifest
                                setAvatarParams((prev) => ({
                                    ...prev,
                                    ...data.params
                                }))
                                setManifest((prev) => ({
                                    ...prev,
                                    name: data.name,
                                    description: data.description
                                }))
                            } catch (error) {
                                console.error('Error parsing manifest.json:', error)
                            }

                            return
                        } else if (file.name.endsWith('.zip')) {
                            const zip = new JSZip()
                            try {
                                const content = await zip.loadAsync(file)
                                console.log('files in zip:', Object.keys(content.files))
                                const manifestFile = content.file('manifest.json')
                                if (manifestFile) {
                                    const text = await manifestFile.async('text')
                                    console.log('Reading manifest.json from zip:', text)
                                    try {
                                        const data = JSON.parse(text) as AvatarManifest
                                        setAvatarParams((prev) => ({
                                            ...prev,
                                            ...data.params
                                        }))
                                        setManifest((prev) => ({
                                            ...prev,
                                            name: data.name,
                                            description: data.description
                                        }))
                                    } catch (error) {
                                        console.error('Error parsing manifest.json from zip:', error)
                                    }
                                }
                                const imageFiles = Object.values(content.files).filter(
                                    (f) =>
                                        f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.jpeg')
                                )
                                for (const imgFile of imageFiles) {
                                    const blob = await imgFile.async('blob')
                                    const name = imgFile.name.split('/').pop() ?? 'unknown.png'
                                    images.push(new File([blob], name, { type: blob.type }))
                                }
                            } catch (error) {
                                console.error('Error reading zip file:', error)
                            }
                        } else if (file.type.startsWith('image/')) {
                            images.push(file)
                        }
                    }

                    console.log('found images:', images)

                    const out = document.createElement('canvas')
                    out.width = 2048
                    out.height = 1024
                    const ctx = out.getContext('2d')
                    if (!ctx) return

                    for (const file of images) {
                        const name = file.name.split('.')[0]
                        const dsize = 274

                        const bitmap = await createImageBitmap(file)
                        if (name in texturePositions) {
                            const pos = texturePositions[name]
                            ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, pos[0], pos[1], dsize, dsize)
                        } else if (symetricTextures.includes(name)) {
                            console.log(`Processing symetric texture: ${name}`)
                            const left = 'Left-' + name
                            const leftPos = texturePositions[left]
                            ctx.drawImage(
                                bitmap,
                                0,
                                0,
                                bitmap.width,
                                bitmap.height,
                                leftPos[0],
                                leftPos[1],
                                dsize,
                                dsize
                            )

                            ctx.save()
                            const right = 'Right-' + name
                            const rightPos = texturePositions[right]
                            //draw the right side mirrored
                            ctx.scale(-1, 1)
                            ctx.drawImage(
                                bitmap,
                                0,
                                0,
                                bitmap.width,
                                bitmap.height,
                                -rightPos[0] - dsize,
                                rightPos[1],
                                dsize,
                                dsize
                            )
                            ctx.restore()
                        } else {
                            ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height)
                        }
                    }

                    const texture = new Texture(out)
                    texture.flipY = false
                    texture.colorSpace = SRGBColorSpace
                    setTexture(texture)
                }}
            />
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
                    label={t('name')}
                    variant="outlined"
                    value={manifest.name || ''}
                    onChange={(e) => setManifest((prev) => ({ ...prev, name: e.target.value }))}
                    sx={{ marginBottom: '20px' }}
                />
                <TextField
                    label={t('description')}
                    variant="outlined"
                    value={manifest.description || ''}
                    onChange={(e) => setManifest((prev) => ({ ...prev, description: e.target.value }))}
                    multiline
                    rows={4}
                    sx={{ marginBottom: '20px' }}
                />

                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: '10px' }}>
                    {t('texture')}
                    <Chip
                        icon={<FaInfoCircle />}
                        color="primary"
                        variant="outlined"
                        size="small"
                        label={t('textureInfoTitle')}
                        onClick={() => setShowEditorHint((prev) => !prev)}
                    />
                </Typography>
                <Collapse in={showEditorHint}>
                    <Alert
                        severity="info"
                        action={
                            <Button
                                component="a"
                                variant="contained"
                                href="https://oekaki-avatar-files.anthrotech.dev/oekakiavatar-template_v1.1.0.psd"
                                download="oekakiavatar-template_v1.1.0.psd"
                            >
                                {t('downloadTemplate')}
                            </Button>
                        }
                    >
                        {t('textureInfo')}
                    </Alert>
                </Collapse>

                <TexturePreview
                    texture={texture ?? defaultTexture}
                    sx={{ width: '300px', height: '150px', border: '1px solid #ccc' }}
                    onClick={() => setEditing(true)}
                />

                <Box>
                    <Typography variant="h6">{t('headSize')}</Typography>
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
                    <Typography variant="h6">{t('neckLength')}</Typography>
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
                            label={t('headInFront')}
                        />
                    </FormGroup>
                </Box>
                <Box>
                    <Typography variant="h6">{t('bodySize')}</Typography>
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
                    <Typography variant="h6">{t('handSize')}</Typography>
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
                    <Typography variant="h6">{t('legsSize')}</Typography>
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
                    <Typography variant="h6">{t('legsDistance')}</Typography>
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
                    <Typography variant="h6">{t('legsDistanceFromBody')}</Typography>
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
                            label={t('legsInFront')}
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
                        label={t('disableTail')}
                    />
                </FormGroup>
                {!avatarParams.disableTail && (
                    <>
                        <Box>
                            <Typography variant="h6">{t('tailSize')}</Typography>
                            <Slider
                                value={avatarParams.tailSize}
                                min={-1}
                                max={1}
                                step={0.01}
                                onChange={(_e, newValue) =>
                                    setAvatarParams((prev) => ({
                                        ...prev,
                                        tailSize: newValue as number
                                    }))
                                }
                                sx={{ width: '200px', padding: '20px' }}
                            />
                            <Typography variant="h6">{t('tailPosition')}</Typography>
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
                            <Typography variant="h6">{t('tailRotation')}</Typography>
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
                <Divider
                    sx={{
                        marginY: '10px'
                    }}
                />
                <Box display="flex" gap="10px">
                    <Button
                        color="error"
                        onClick={() => {
                            confirm.open(
                                t('confirmDiscard'),
                                () => {
                                    init()
                                    navigate('/')
                                },
                                {
                                    description: t('confirmDiscardDescription')
                                }
                            )
                        }}
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (fileInputRef.current) {
                                fileInputRef.current.click()
                            }
                        }}
                    >
                        {t('load')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={!texture}
                        endIcon={<FaCaretDown />}
                        onClick={(e) => {
                            setExportAnchorEl(e.currentTarget)
                        }}
                    >
                        {t('export')}
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
                        {t('done')}
                    </Button>
                </Box>
            </Box>
            <Menu open={Boolean(exportAnchorEl)} anchorEl={exportAnchorEl} onClose={() => setExportAnchorEl(null)}>
                <MenuItem
                    onClick={() => {
                        if (!texture) {
                            alert('テクスチャが設定されていません。ペイントを行ってください。')
                            return
                        }
                        handleResoniteExport(
                            {
                                ...manifest,
                                creatorID: props.deviceID,
                                extends: parent?.id,
                                params: avatarParams
                            },
                            texture
                        )
                    }}
                >
                    {t('resoniteAvatar')}
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (!texture) {
                            alert('テクスチャが設定されていません。ペイントを行ってください。')
                            return
                        }
                        handleExport(
                            {
                                ...manifest,
                                creatorID: props.deviceID,
                                extends: parent?.id,
                                params: avatarParams
                            },
                            texture
                        )
                    }}
                >
                    {t('zipFile')}
                </MenuItem>
            </Menu>
            <Modal
                open={!!editing}
                onClose={() => {
                    setEditing(false)
                }}
            >
                <>
                    <Painter
                        width={2048}
                        height={1024}
                        initialTexture={texture ?? undefined}
                        onDone={(textureURL) => {
                            const loader = new TextureLoader()
                            loader.load(textureURL, (tex) => {
                                tex.flipY = false
                                tex.colorSpace = SRGBColorSpace
                                setTexture(tex)
                                setEditing(false)
                            })
                        }}
                    />
                </>
            </Modal>

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md">
                {uploaded ? (
                    <>
                        <DialogTitle>{t('published')}</DialogTitle>
                        <DialogContent>
                            {t('publishedMessage')}
                            <Button
                                onClick={() => {
                                    navigator.clipboard.writeText(location.origin + '/' + uploaded.id)
                                }}
                            >
                                {t('copyURL')}
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    window.open(
                                        `https://x.com/intent/tweet?text=${encodeURIComponent(
                                            `#OekakiAvatar
${location.origin}/${uploaded.id}`
                                        )}`
                                    )
                                }}
                            >
                                {t('shareToX')}
                            </Button>
                        </DialogContent>
                        <DialogActions>
                            <Button
                                onClick={() => {
                                    setOpen(false)
                                    init()
                                    navigate('/')
                                }}
                            >
                                {t('close')}
                            </Button>
                        </DialogActions>
                    </>
                ) : (
                    <>
                        <DialogTitle
                            sx={{
                                paddingBottom: '0px'
                            }}
                        >
                            {t('publish')}: {manifest.name}
                        </DialogTitle>
                        <DialogContent
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '20px'
                            }}
                        >
                            <Typography>{t('publishHint')}</Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: { xs: 'column', sm: 'row' },
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
                                        label={t('creatorName')}
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
                                            label={t('allowModify')}
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={manifest.exportable || false}
                                                    onChange={(e) =>
                                                        setManifest((prev) => ({
                                                            ...prev,
                                                            exportable: e.target.checked
                                                        }))
                                                    }
                                                />
                                            }
                                            label={t('allowExport')}
                                        />
                                    </FormGroup>
                                    <Turnstile
                                        siteKey={'0x4AAAAAABtwtFZj5wbp5rqD'}
                                        onSuccess={(token) => {
                                            setToken(token)
                                        }}
                                        onExpire={() => {
                                            setToken(null)
                                        }}
                                    />
                                </Box>
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setOpen(false)}>{t('cancel')}</Button>
                            <Button
                                variant="contained"
                                disabled={uploading || !manifest.creator || !token}
                                onClick={() => {
                                    setUploading(true)
                                    if (!texture) {
                                        alert('テクスチャが設定されていません。ペイントを行ってください。')
                                        setUploading(false)
                                        return
                                    }
                                    if (!thumbnailBlob) {
                                        alert('サムネイルが生成されていません。もう一度公開を試みてください。')
                                        setUploading(false)
                                        return
                                    }
                                    if (!token) {
                                        alert('Turnstileの認証が完了していません。もう一度公開を試みてください。')
                                        setUploading(false)
                                        return
                                    }
                                    handlePublish(
                                        thumbnailBlob,
                                        {
                                            ...manifest,
                                            creatorID: props.deviceID,
                                            extends: parent?.id,
                                            params: avatarParams
                                        },
                                        texture,
                                        token
                                    )
                                        .then((data) => {
                                            props.setCollection((prev) => [...prev, data.id])
                                            setUploaded(data)
                                        })
                                        .finally(() => {
                                            setUploading(false)
                                        })
                                }}
                            >
                                {uploading ? t('sending') : t('publish')}
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </>
    )
}
