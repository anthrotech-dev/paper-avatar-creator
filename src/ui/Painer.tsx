import { Box, IconButton } from '@mui/material'
import { useEffect, useRef, useState } from 'react'

import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

import { IoIosUndo } from 'react-icons/io'
import { IoIosRedo } from 'react-icons/io'
import { MdLayers } from 'react-icons/md'
import { MdLayersClear } from 'react-icons/md'
import { PiPaintBrushFill } from 'react-icons/pi'
import { PiPaintBucketFill } from 'react-icons/pi'
import { PiPaletteFill } from 'react-icons/pi'
import { PiEraserFill } from 'react-icons/pi'
import { MdDelete } from 'react-icons/md'

const MAX_HISTORY = 30

type PainterProps = {
    width: number
    height: number
}

interface History {
    imageData: ImageData
    layer: number
}

export function Painter(props: PainterProps) {
    const [tool, setTool] = useState<'brush' | 'eraser' | 'fill'>('brush')

    const [currentLayer, setCurrentLayer] = useState<number>(0)
    const [hiddenLayers, setHiddenLayers] = useState<Array<boolean>>([false, false, false])

    const colorInputRef = useRef<HTMLInputElement>(null)
    const historyRef = useRef<History[]>([])
    const redoRef = useRef<History[]>([])

    const [brushSize, setBrushSize] = useState<number>(32)

    const [color, setColor] = useState<string>('#000000')
    const [alpha, setAlpha] = useState<number>(1.0)

    const [hardness, setHardness] = useState<number>(0.5)

    const canvasRef0 = useRef<HTMLCanvasElement>(null)
    const canvasRef1 = useRef<HTMLCanvasElement>(null)
    const canvasRef2 = useRef<HTMLCanvasElement>(null)
    const canvasRefs = [canvasRef0, canvasRef1, canvasRef2]
    const canvasRef = canvasRefs[currentLayer]

    const brushRef = useRef<HTMLCanvasElement>(null)
    const [drawing, setDrawing] = useState(false)
    const prevPos = useRef<[number, number] | null>(null)
    const leftoverRef = useRef(0)

    const transform = useRef<{
        scale: number
        positionX: number
        positionY: number
    }>({
        scale: 1,
        positionX: 0,
        positionY: 0
    })

    useEffect(() => {
        let b = brushRef.current
        if (!b) {
            brushRef.current = b = document.createElement('canvas')
        }
        b.width = b.height = brushSize
        const g = b.getContext('2d')!
        const r = brushSize / 2
        const grad = g.createRadialGradient(r, r, 0, r, r, r)
        const alphaColor =
            color +
            Math.round(alpha * 255)
                .toString(16)
                .padStart(2, '0')
        grad.addColorStop(0, alphaColor)
        grad.addColorStop(hardness, alphaColor)
        grad.addColorStop(1, `${color}00`)
        g.fillStyle = grad
        g.fillRect(0, 0, brushSize, brushSize)
        brushRef.current = b
    }, [brushSize, color, hardness, alpha])

    const stamp = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
        const r = brushSize / 2
        ctx.save()
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
        ctx.drawImage(brushRef.current!, x - r, y - r)
        ctx.restore()
    }

    const bucketFill = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const ctx = canvasRef.current!.getContext('2d')!
        const fill = color
            .replace('#', '')
            .match(/../g)!
            .map((c) => parseInt(c, 16))
        fill.push(Math.round(alpha * 255)) // アルファ値を追加
        console.log('fill', color, alpha, fill)

        const sx = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / transform.current.scale)
        const sy = Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / transform.current.scale)

        const { width: W, height: H } = ctx.canvas

        const img = ctx.getImageData(0, 0, W, H)
        const buf32 = new Uint32Array(img.data.buffer) // BGRA リトルエンディアン

        const toUint32 = ([r, g, b, a]: number[]) => (a << 24) | (b << 16) | (g << 8) | r

        const target = buf32[sy * W + sx]
        const fill32 = toUint32(fill)

        if (target === fill32) return // 既に同色なら何もしない

        const stack: [number, number][] = [[sx, sy]]

        const tot = W * H
        const visited = new Uint8Array(Math.ceil(tot / 8))

        const isVisited = (i: number) => (visited[i >> 3] & (1 << (i & 7))) !== 0
        const setVisited = (i: number) => {
            visited[i >> 3] |= 1 << (i & 7)
        }

        while (stack.length) {
            let [x, y] = stack.pop()!
            let pos = y * W + x

            /* ① 上へ伸ばす */
            while (y > 0 && buf32[pos - W] === target) {
                y--
                pos -= W
            }

            /* ② 下へ走査しながら左右をキューに積む */
            let spanLeft = false,
                spanRight = false
            while (y < H && buf32[pos] === target && !isVisited(pos)) {
                buf32[pos] = fill32 // 塗り
                setVisited(pos)

                // 左チェック
                if (x > 0) {
                    if (buf32[pos - 1] === target) {
                        if (!spanLeft) {
                            stack.push([x - 1, y])
                            spanLeft = true
                        }
                    } else spanLeft = false
                }

                // 右チェック
                if (x < W - 1) {
                    if (buf32[pos + 1] === target) {
                        if (!spanRight) {
                            stack.push([x + 1, y])
                            spanRight = true
                        }
                    } else spanRight = false
                }

                y++
                pos += W // 下へ 1 ピクセル
            }
        }

        ctx.putImageData(img, 0, 0)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!drawing) return
        // only handle left mouse button
        if (e.buttons !== 1) return

        const rect = canvasRef.current!.getBoundingClientRect()
        const x = (e.clientX - rect.left) / transform.current.scale
        const y = (e.clientY - rect.top) / transform.current.scale

        const ctx = canvasRef.current!.getContext('2d')!
        const spacing = brushSize * 0.1

        if (prevPos.current) {
            let [px, py] = prevPos.current
            let dx = x - px,
                dy = y - py
            let dist = Math.hypot(dx, dy)

            // ① 余り距離を加算
            dist += leftoverRef.current

            // ② ベクトル正規化（0 除算防止）
            const ux = dx === 0 && dy === 0 ? 0 : dx / Math.hypot(dx, dy)
            const uy = dy === 0 && dx === 0 ? 0 : dy / Math.hypot(dx, dy)

            // ③ 等間隔でスタンプ
            while (dist >= spacing) {
                px += ux * spacing
                py += uy * spacing
                stamp(ctx, px, py)
                dist -= spacing
            }

            // ④ 余った距離を保存
            leftoverRef.current = dist
            prevPos.current = [px, py]
        } else {
            stamp(ctx, x, y)
            leftoverRef.current = 0
            prevPos.current = [x, y]
        }
    }

    const pushHistory = () => {
        const ctx = canvasRefs[currentLayer].current!.getContext('2d')!
        historyRef.current.push({
            layer: currentLayer,
            imageData: ctx.getImageData(0, 0, props.width, props.height)
        })
        if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
        redoRef.current.length = 0 // 新操作したら Redo クリア
    }

    const undo = () => {
        if (!historyRef.current.length) return

        const history = historyRef.current.pop()!

        const ctx = canvasRefs[history.layer].current!.getContext('2d')!
        const img = history.imageData

        redoRef.current.push({
            layer: history.layer,
            imageData: ctx.getImageData(0, 0, props.width, props.height)
        })
        ctx.putImageData(img, 0, 0)
    }
    const redo = () => {
        if (!redoRef.current.length) return

        const history = redoRef.current.pop()!
        const ctx = canvasRefs[history.layer].current!.getContext('2d')!
        const img = history.imageData
        historyRef.current.push({
            layer: history.layer,
            imageData: ctx.getImageData(0, 0, props.width, props.height)
        })
        ctx.putImageData(img, 0, 0)
    }

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        pushHistory()

        if (tool === 'fill') {
            bucketFill(e)
        } else {
            setDrawing(true)
            prevPos.current = null // 前の位置をリセット
            handlePointerMove(e)
        }
    }

    const onPointerUp = () => {
        setDrawing(false)
        prevPos.current = null // 描画終了時に前の位置をリセット
    }

    return (
        <Box
            width={'100%'}
            height={'100%'}
            position={'relative'}
            sx={{
                userSelect: 'none'
            }}
        >
            <TransformWrapper
                initialScale={1}
                initialPositionX={0}
                initialPositionY={0}
                minScale={0.1}
                maxScale={10}
                wheel={{ step: 50 }}
                panning={{
                    allowLeftClickPan: false
                }}
                onTransformed={(_, { scale, positionX, positionY }) => {
                    transform.current = { scale, positionX, positionY }
                }}
            >
                <TransformComponent
                    wrapperStyle={{
                        width: '100%',
                        height: '100%'
                    }}
                >
                    <Box
                        sx={{
                            backgroundColor: '#fff',
                            width: `${props.width}px`,
                            height: `${props.height}px`,
                            position: 'relative'
                        }}
                    >
                        <canvas
                            ref={canvasRef2}
                            width={props.width}
                            height={props.height}
                            style={{
                                touchAction: 'none',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                visibility: hiddenLayers[2] ? 'hidden' : 'visible'
                            }}
                            onPointerDown={onPointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={onPointerUp}
                        />
                        <canvas
                            ref={canvasRef1}
                            width={props.width}
                            height={props.height}
                            style={{
                                touchAction: 'none',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                visibility: hiddenLayers[1] ? 'hidden' : 'visible'
                            }}
                            onPointerDown={onPointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={onPointerUp}
                        />
                        <canvas
                            ref={canvasRef0}
                            width={props.width}
                            height={props.height}
                            style={{
                                touchAction: 'none',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                visibility: hiddenLayers[0] ? 'hidden' : 'visible'
                            }}
                            onPointerDown={onPointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={onPointerUp}
                        />
                    </Box>
                </TransformComponent>
            </TransformWrapper>

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    position: 'absolute',
                    top: 0,
                    right: '50px',
                    padding: 1,
                    gap: 1
                }}
            >
                <IconButton
                    size="large"
                    sx={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: 'primary.main'
                    }}
                    onClick={undo}
                >
                    <IoIosUndo color="white" />
                </IconButton>
                <IconButton
                    size="large"
                    sx={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: 'primary.main'
                    }}
                    onClick={redo}
                >
                    <IoIosRedo color="white" />
                </IconButton>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'absolute',
                    top: '50px',
                    right: 0,
                    padding: 1,
                    gap: 1
                }}
            >
                <Box
                    onClick={() => {
                        if (currentLayer === 0) {
                            hiddenLayers[0] = !hiddenLayers[0]
                            setHiddenLayers([...hiddenLayers])
                        } else {
                            setCurrentLayer(0)
                        }
                    }}
                    sx={{
                        cursor: 'pointer',
                        backgroundColor: currentLayer === 0 ? 'primary.main' : 'text.disabled',
                        color: 'white',
                        padding: '5px',
                        borderRadius: '5px',
                        border: '1px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px'
                    }}
                >
                    {hiddenLayers[0] ? <MdLayersClear color="white" size={24} /> : <MdLayers color="white" size={24} />}
                    1
                </Box>
                <Box
                    onClick={() => {
                        if (currentLayer === 1) {
                            hiddenLayers[1] = !hiddenLayers[1]
                            setHiddenLayers([...hiddenLayers])
                        } else {
                            setCurrentLayer(1)
                        }
                    }}
                    sx={{
                        cursor: 'pointer',
                        backgroundColor: currentLayer === 1 ? 'primary.main' : 'text.disabled',
                        color: 'white',
                        padding: '5px',
                        borderRadius: '5px',
                        border: '1px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px'
                    }}
                >
                    {hiddenLayers[1] ? <MdLayersClear color="white" size={24} /> : <MdLayers color="white" size={24} />}
                    2
                </Box>
                <Box
                    onClick={() => {
                        if (currentLayer === 2) {
                            hiddenLayers[2] = !hiddenLayers[2]
                            setHiddenLayers([...hiddenLayers])
                        } else {
                            setCurrentLayer(2)
                        }
                    }}
                    sx={{
                        cursor: 'pointer',
                        backgroundColor: currentLayer === 2 ? 'primary.main' : 'text.disabled',
                        color: 'white',
                        padding: '5px',
                        borderRadius: '5px',
                        border: '1px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px'
                    }}
                >
                    {hiddenLayers[2] ? <MdLayersClear color="white" size={24} /> : <MdLayers color="white" size={24} />}
                    3
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    padding: 1,
                    gap: 1
                }}
            >
                <input
                    type="range"
                    min="8"
                    max="128"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                />
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={hardness}
                    onChange={(e) => setHardness(Number(e.target.value))}
                />
                <IconButton
                    size="large"
                    sx={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: tool === 'brush' ? 'primary.main' : 'text.disabled'
                    }}
                    onClick={() => setTool('brush')}
                >
                    <PiPaintBrushFill color="white" />
                </IconButton>
                <IconButton
                    size="large"
                    sx={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: tool === 'eraser' ? 'primary.main' : 'text.disabled'
                    }}
                    onClick={() => setTool('eraser')}
                >
                    <PiEraserFill color="white" />
                </IconButton>
                <IconButton
                    size="large"
                    sx={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: tool === 'fill' ? 'primary.main' : 'text.disabled'
                    }}
                    onClick={() => setTool('fill')}
                >
                    <PiPaintBucketFill color="white" />
                </IconButton>

                <Box display="flex" flexDirection="row" alignItems="center" justifyContent="center" gap={2}>
                    <IconButton
                        size="large"
                        sx={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: color
                        }}
                        onClick={() => {
                            if (colorInputRef.current) {
                                colorInputRef.current.click()
                            }
                        }}
                    >
                        <PiPaletteFill color="white" />
                        <input
                            ref={colorInputRef}
                            type="color"
                            value={color}
                            style={{
                                visibility: 'hidden',
                                position: 'absolute'
                            }}
                            onChange={(e) => setColor(e.target.value)}
                        />
                    </IconButton>

                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={alpha}
                        onChange={(e) => setAlpha(Number(e.target.value))}
                    />
                </Box>

                <IconButton
                    size="large"
                    onClick={() => {
                        const ctx = canvasRef.current!.getContext('2d')!
                        ctx.clearRect(0, 0, props.width, props.height)
                    }}
                    sx={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: 'error.main'
                    }}
                >
                    <MdDelete color="white" />
                </IconButton>
            </Box>
        </Box>
    )
}
