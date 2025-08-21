import { Alert, Box, Button, Divider, Link, Typography } from '@mui/material'
import {
    createContext,
    Suspense,
    useContext,
    useEffect,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction
} from 'react'
import type { AvatarManifest } from '../types'
import { Drawer } from '../ui/Drawer'
import { Avatar } from '../components/Avatar'
import { Link as NavLink, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { CfmRenderer } from '../ui/CfmRenderer'
import { useTranslation } from 'react-i18next'
import { FaStar } from 'react-icons/fa'

interface PreviewProps {
    id: string
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

Preview.Overlay = (props: { collection: string[]; setCollection: Dispatch<SetStateAction<string[]>> }) => {
    const { manifest } = usePreview()
    const navigate = useNavigate()

    const { t } = useTranslation('')

    return (
        <Drawer open={!!manifest}>
            {manifest && (
                <>
                    <Helmet>
                        <title>おえかきアバター | {manifest.name}</title>
                        <meta name="description" content={manifest.description} />
                    </Helmet>
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
                        {manifest.extends && (
                            <Link component={NavLink} to={'/' + manifest.extends}>
                                {t('extends')}
                            </Link>
                        )}
                        <Divider />
                        {manifest.description && <CfmRenderer message={manifest.description} />}
                        {manifest.exportable ? (
                            <Alert severity="success">{t('exportable')}</Alert>
                        ) : (
                            <Alert severity="info">{t('notExportable')}</Alert>
                        )}

                        {manifest.editable ? (
                            <Alert severity="success">{t('modifiable')}</Alert>
                        ) : (
                            <Alert severity="info">{t('notModifiable')}</Alert>
                        )}
                    </Box>
                    <Button
                        color="primary"
                        sx={{ margin: '1rem' }}
                        onClick={() => {
                            navigate('/')
                        }}
                    >
                        {t('close')}
                    </Button>
                    <Button
                        startIcon={<FaStar />}
                        variant="contained"
                        sx={{ margin: '1rem' }}
                        disabled={props.collection.includes(manifest.id)}
                        onClick={() => {
                            props.setCollection([...props.collection, manifest.id])
                            navigate('/')
                        }}
                    >
                        {props.collection.includes(manifest.id) ? t('alreadyInCollection') : t('addToCollection')}
                    </Button>
                </>
            )}
        </Drawer>
    )
}
