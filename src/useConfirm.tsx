import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface ConfirmOptions {
    description?: string | ReactNode
    confirmText?: string
    cancelText?: string
}

export interface ConfirmState {
    open: (title: string, onConfirm: () => void, opts?: ConfirmOptions) => void
}

const ConfirmContext = createContext<ConfirmState>({
    open: () => {}
})

interface ConfirmProviderProps {
    children: ReactNode
}

export const ConfirmProvider = (props: ConfirmProviderProps): ReactNode => {
    const [title, setTitle] = useState<string | null>(null)
    const [opts, setOpts] = useState<ConfirmOptions | null>(null)
    const [onConfirm, setOnConfirm] = useState<() => void>(() => () => {})

    const open = useCallback((title: string, onConfirm: () => void, opts?: ConfirmOptions) => {
        setTitle(title)
        setOnConfirm(() => onConfirm)
        setOpts(opts ?? null)
    }, [])

    const close = useCallback(() => {
        setTitle(null)
        setOnConfirm(() => () => {})
        setOpts(null)
    }, [])

    return (
        <ConfirmContext.Provider
            value={useMemo(
                () => ({
                    open
                }),
                [open]
            )}
        >
            {props.children}
            <Dialog open={title !== null} onClose={close}>
                <DialogTitle>{title}</DialogTitle>

                {typeof opts?.description === 'string' ? (
                    <DialogContent>
                        <DialogContentText>{opts.description}</DialogContentText>
                    </DialogContent>
                ) : (
                    <DialogContent>{opts?.description}</DialogContent>
                )}

                <DialogActions>
                    <Button onClick={close}>{opts?.cancelText ?? 'Cancel'}</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            onConfirm()
                            close()
                        }}
                    >
                        {opts?.confirmText ?? 'OK'}
                    </Button>
                </DialogActions>
            </Dialog>
        </ConfirmContext.Provider>
    )
}

export const useConfirm = (): ConfirmState => {
    return useContext(ConfirmContext)
}
