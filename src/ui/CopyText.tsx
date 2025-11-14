import { Divider, IconButton, InputBase, Paper } from '@mui/material'
import { MdContentPaste } from 'react-icons/md'

type CopyTextProps = {
    text: string
}

export const CopyText = ({ text }: CopyTextProps) => {
    return (
        <Paper sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400 }}>
            <InputBase sx={{ ml: 1, flex: 1 }} value={text} readOnly fullWidth />
            <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
            <IconButton
                color="primary"
                sx={{ p: '10px' }}
                aria-label="directions"
                onClick={() => {
                    navigator.clipboard.writeText(text)
                }}
            >
                <MdContentPaste />
            </IconButton>
        </Paper>
    )
}
