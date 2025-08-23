import * as React from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Slider from '@mui/material/Slider'
import Input from '@mui/material/Input'
import type { SxProps } from '@mui/material'

type InputSliderProps = {
    value: number
    onChange: (newValue: number) => void
    label: string
    min: number
    max: number
    step: number
    sx?: SxProps
    singleColumn?: boolean
}

export default function InputSlider(props: InputSliderProps) {
    const value = props.value
    const setValue = props.onChange

    const handleSliderChange = (_event: Event, newValue: number) => {
        setValue(newValue)
    }

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value === '' ? 0 : Number(event.target.value))
    }

    const handleBlur = () => {
        if (value < props.min) {
            setValue(props.min)
        } else if (value > props.max) {
            setValue(props.max)
        }
    }

    return (
        <Box sx={props.sx}>
            {!props.singleColumn && (
                <Typography id="input-slider" gutterBottom>
                    {props.label}
                </Typography>
            )}
            <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                {props.singleColumn && (
                    <Typography id="input-slider" gutterBottom>
                        {props.label}
                    </Typography>
                )}
                <Grid size="grow">
                    <Slider
                        value={typeof value === 'number' ? value : 0}
                        onChange={handleSliderChange}
                        aria-labelledby="input-slider"
                        min={props.min}
                        max={props.max}
                        sx={{ width: '100px' }}
                        step={props.step}
                    />
                </Grid>
                <Grid>
                    <Input
                        value={value}
                        size="small"
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        inputProps={{
                            min: props.min,
                            max: props.max,
                            type: 'number',
                            'aria-labelledby': 'input-slider'
                        }}
                        sx={{ width: 42 }}
                    />
                </Grid>
            </Grid>
        </Box>
    )
}
