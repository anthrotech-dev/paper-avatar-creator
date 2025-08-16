import { Box, Drawer as MuiDrawer, useMediaQuery, useTheme } from '@mui/material'
import type { ReactNode } from 'react'

export interface CCDrawerProps {
    children?: ReactNode
    open: boolean
    onOpen?: () => void
    onClose?: () => void
}

export const Drawer = (props: CCDrawerProps): ReactNode => {
    const theme = useTheme()
    const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))

    return (
        <MuiDrawer
            variant="persistent"
            hideBackdrop={true}
            anchor={isMobileSize ? 'bottom' : 'right'}
            open={props.open}
            onClose={() => {
                props.onClose?.()
            }}
            slotProps={{
                paper: {
                    sx: {
                        display: 'flex',
                        flexDirection: 'column',
                        width: {
                            xs: '100%',
                            sm: '50%'
                        },
                        minWidth: {
                            sm: '420px'
                        },
                        maxWidth: {
                            sm: '800px'
                        },
                        height: {
                            xs: '80vh',
                            sm: '100%'
                        },
                        borderRadius: {
                            xs: '10px 10px 0 0',
                            sm: '10px 0 0 10px'
                        }
                    }
                }
            }}
            slots={{
                backdrop: undefined
            }}
        >
            <Box
                sx={{
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    flex: 1
                }}
                onTouchStart={(e) => {
                    e.stopPropagation()
                }}
            >
                {props.children}
            </Box>
        </MuiDrawer>
    )
}
