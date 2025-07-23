import { useEffect, useRef, useState } from "react"
import { Texture } from "three"

type TexturePreviewProps = {
    texture?: Texture
    style?: React.CSSProperties
    onClick?: (e: React.MouseEvent<HTMLDivElement | HTMLImageElement>) => void
}

export function TexturePreview(props: TexturePreviewProps) {

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [src, setSrc] = useState<string>()
    const wrapper = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!props.texture) return;

        const img = (props.texture.image ?? props.texture.source?.data) as unknown;

        // ---- HTMLImageElement → <img>
        if (img instanceof HTMLImageElement) {
            setSrc(img.currentSrc || img.src);
            return;
        }

        // ---- HTMLCanvasElement → 既存 Canvas を流用
        if (img instanceof HTMLCanvasElement) {
            setSrc(undefined);
            if (canvasRef.current && canvasRef.current !== img) {
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.display = 'block';
                canvasRef.current.replaceWith(img);
                canvasRef.current = img;
            }
            return;
        }

    }, [props.texture]);

    return <div
        ref={wrapper}
        style={{
            ...props.style,
            overflow: 'hidden',
            cursor: props.onClick ? 'pointer' : 'default',
        }}
        onClick={props.onClick}
    >
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
    </div>

}



