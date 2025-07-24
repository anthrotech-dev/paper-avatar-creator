import { Box, type SxProps } from "@mui/material"
import { useEffect, useRef, useState } from "react"
import { Texture } from "three"

type TexturePreviewProps = {
    texture?: Texture
    onClick?: (e: React.MouseEvent<HTMLDivElement | HTMLImageElement>) => void
    sx?: SxProps
}

export function TexturePreview(props: TexturePreviewProps) {

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [src, setSrc] = useState<string>()
    const wrapper = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!props.texture) return;

        const img = (props.texture.image ?? props.texture.source?.data) as unknown;

        if (img instanceof HTMLImageElement) {
            setSrc(img.currentSrc || img.src);
            return;
        }

        if (img instanceof HTMLCanvasElement) {
            setSrc(undefined);
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
                }
            }
            return;
        }

    }, [props.texture]);

    return <Box
        ref={wrapper}
        sx={{
            ...props.sx,
            overflow: 'hidden',
            cursor: props.onClick ? 'pointer' : 'default',
        }}
        onClick={props.onClick}
    >
        {props.texture && <>
            {src ? (
                <img 
                    src={src}
                    alt="Texture Preview"
                    style={{ width: '100%', height: '100%' }} 
                />
            ) : (
                <canvas
                    ref={canvasRef} 
                    width={wrapper.current?.clientWidth || 256}
                    height={wrapper.current?.clientHeight || 256}
                    style={{ width: '100%', height: '100%' }}
                />
            )}
        </>}
    </Box>
}

