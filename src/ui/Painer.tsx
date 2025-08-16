import { Box, IconButton, Menu, MenuItem, Popover, Slider, Typography } from '@mui/material'

import { BsFillEraserFill } from 'react-icons/bs'
import { BsBrushFill } from 'react-icons/bs'
import { BsFillPaletteFill } from 'react-icons/bs'
import { IoIosUndo } from 'react-icons/io'
import { MdDelete } from 'react-icons/md'
import { MdLayers } from 'react-icons/md'
import { MdLayersClear } from 'react-icons/md'

import Konva from 'konva'
import { Stage, Layer, Line, Rect, Circle } from 'react-konva'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { CanvasTexture, SRGBColorSpace, Texture, TextureLoader } from 'three'
import { TexturePreview } from './TexturePreview'

type PainterProps = {
    initialTexture?: Texture | null
    drawingLayerRef: RefObject<Konva.Layer | null>
    references?: Record<string, Texture>
    size: number
}

interface stroke {
    tool: string
    points: number[]
    color: string
    width: number
}

export function Painter(props: PainterProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const stageRef = useRef<Konva.Stage>(null)
    const previewLayerRef = useRef<Konva.Layer>(null)
    const circleRef = useRef<Konva.Circle>(null)

    const isDrawing = useRef(false)

    const [color, setColor] = useState('#2e7eff')
    const [width, setWidth] = useState(20)
    const [widthAnchor, setWidthAnchor] = useState<HTMLButtonElement | null>(null)

    const [oldTexture, setOldTexture] = useState<Texture | null>(null)

    const [traceAnchor, setTraceAnchor] = useState<HTMLDivElement | null>(null)
    const [traceTexture, setTraceTexture] = useState<Texture | undefined>(undefined)

    const colorInputRef = useRef<HTMLInputElement>(null)

    const [tool, setTool] = useState('brush')

    const [layers, setLayers] = useState<Array<stroke>[]>([[], [], []])
    const [currentLayer, setCurrentLayer] = useState<0 | 1 | 2>(0)

    const [hiddenLayers, setHiddenLayers] = useState<Array<boolean>>([false, false, false])

    useEffect(() => {
        const stage = stageRef.current
        const previewLayer = previewLayerRef.current
        const circle = circleRef.current

        if (!stage || !previewLayer || !circle) return

        // レイヤーはヒットテスト不要＆クリックイベントを受けない
        previewLayer.listening(false)
        previewLayer.hitGraphEnabled(false)

        const updateCircle = () => {
            const p = stage.getPointerPosition()
            if (!p) {
                // ステージ外なら隠す
                circle.visible(false)
                previewLayer.batchDraw()
                return
            }
            // ステージがズーム・ドラッグしている場合も正しく表示
            // getRelativePointerPosition(layer) を使うと簡単
            const pos = stage.getRelativePointerPosition()
            circle.position(pos)
            circle.visible(true)
            previewLayer.batchDraw()
        }

        // 描画負荷を減らすため requestAnimationFrame を挟む
        let raf = 0
        const handleMove = () => {
            if (raf) cancelAnimationFrame(raf)
            raf = requestAnimationFrame(updateCircle)
        }

        stage.on('mousemove touchmove', handleMove)
        stage.on('mouseout', () => {
            circle.visible(false)
            previewLayer.batchDraw()
        })

        return () => {
            stage.off('mousemove touchmove', handleMove)
            stage.off('mouseout')
            if (raf) cancelAnimationFrame(raf)
        }
    }, [])

    useEffect(() => {
        if (props.initialTexture) setOldTexture(props.initialTexture.clone())
    }, [props.initialTexture])

    const handleUndo = () => {
        if (layers[currentLayer].length === 0) return
        const newLayers = [...layers]
        newLayers[currentLayer] = newLayers[currentLayer].slice(0, -1)
        setLayers(newLayers)
    }

    // register keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleUndo()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [handleUndo])

    useEffect(() => {
        const circle = circleRef.current
        if (!circle) return
        circle.radius(width / 2)
        circle.getLayer()?.batchDraw()
    }, [width])

    const handleMouseUp = () => {
        isDrawing.current = false
    }

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        isDrawing.current = true
        const pos = e.target.getStage()?.getPointerPosition()
        if (!pos) return
        const newStroke: stroke = {
            tool,
            points: [pos.x, pos.y],
            color,
            width
        }
        const newLayers = [...layers]
        if (newLayers[currentLayer]) {
            newLayers[currentLayer].push(newStroke)
        } else {
            newLayers[currentLayer] = [newStroke]
        }
        setLayers(newLayers)
    }

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        // no drawing - skipping
        if (!isDrawing.current) {
            return
        }
        const stage = e.target.getStage()
        const point = stage?.getPointerPosition()
        if (!point) return

        let strokes = layers[currentLayer]
        const lastStroke = strokes[strokes.length - 1]

        lastStroke.points = lastStroke.points.concat([point.x, point.y])

        strokes.splice(strokes.length - 1, 1, lastStroke)

        setLayers((prev) => {
            const newLayers = [...prev]
            newLayers[currentLayer] = strokes
            return newLayers
        })
    }

    const setReferenceByName = (name: string) => {
        const loader = new TextureLoader()
        loader.load(`/tex/${name}.png`, (texture) => {
            texture.flipY = false
            texture.colorSpace = SRGBColorSpace
            setTraceTexture(texture)
        })
    }

    const setReferenceByTexture = (texture: Texture) => {
        const canvas = texture.image as HTMLCanvasElement
        const tmp = document.createElement('canvas')
        tmp.width = canvas.width
        tmp.height = canvas.height
        const ctx = tmp.getContext('2d')
        if (!ctx) return
        ctx.drawImage(canvas, 0, 0)
        const editedTexture = new CanvasTexture(tmp)
        editedTexture.flipY = false
        editedTexture.colorSpace = SRGBColorSpace
        setTraceTexture(editedTexture)
    }

    return (
        <>
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple={false}
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return

                    const url = URL.createObjectURL(file)
                    const loader = new TextureLoader()

                    loader.load(url, (texture) => {
                        texture.flipY = false
                        texture.colorSpace = SRGBColorSpace
                        setOldTexture(texture)
                    })
                }}
            />
            <Box
                display="flex"
                alignItems="center"
                gap={1}
                sx={{
                    userSelect: 'none'
                }}
            >
                <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="flex-end"
                    height={`${props.size}px`}
                    gap={1}
                >
                    <IconButton
                        size="large"
                        sx={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: tool === 'brush' ? 'primary.main' : 'text.disabled'
                        }}
                        onClick={() => setTool('brush')}
                    >
                        <BsBrushFill color="white" />
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
                        <BsFillEraserFill color="white" />
                    </IconButton>

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
                        <BsFillPaletteFill color="white" />
                        <input
                            type="color"
                            ref={colorInputRef}
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            style={{
                                visibility: 'hidden',
                                width: '0',
                                height: '0'
                            }}
                        />
                    </IconButton>

                    <IconButton
                        size="large"
                        sx={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: 'primary.main'
                        }}
                        onClick={(e) => setWidthAnchor(e.currentTarget)}
                    >
                        <Typography variant="body1" sx={{ color: 'white' }}>
                            {width}
                        </Typography>
                    </IconButton>

                    <Popover
                        open={Boolean(widthAnchor)}
                        anchorEl={widthAnchor}
                        onClose={() => setWidthAnchor(null)}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'center'
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'center'
                        }}
                        slotProps={{
                            paper: {
                                sx: {
                                    padding: '10px',
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    color: 'white',
                                    borderRadius: '10px'
                                }
                            }
                        }}
                    >
                        <Slider
                            value={width}
                            min={1}
                            max={50}
                            onChange={(_e, newValue) => setWidth(newValue as number)}
                            sx={{ width: '200px', padding: '20px' }}
                            onChangeCommitted={() => setWidthAnchor(null)}
                        />
                    </Popover>

                    <IconButton
                        size="large"
                        onClick={handleUndo}
                        sx={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: 'primary.main'
                        }}
                    >
                        <IoIosUndo color="white" />
                    </IconButton>

                    <IconButton
                        size="large"
                        onClick={() => {
                            setLayers([])
                            setOldTexture(null)
                        }}
                        sx={{
                            backgroundColor: 'error.main'
                        }}
                    >
                        <MdDelete color="white" />
                    </IconButton>
                </Box>

                <Box
                    sx={{
                        background: `repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 / 25px 25px`
                    }}
                >
                    <Stage
                        ref={stageRef}
                        width={props.size}
                        height={props.size}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onTouchStart={handleMouseDown}
                        onTouchMove={handleMouseMove}
                        onTouchEnd={handleMouseUp}
                        style={{ cursor: 'none', border: '1px solid #ccc' }}
                    >
                        {traceTexture && (
                            <Layer>
                                <Rect
                                    x={0}
                                    y={0}
                                    width={props.size}
                                    height={props.size}
                                    fillPatternImage={traceTexture.image as HTMLImageElement}
                                    fillPatternRepeat="no-repeat"
                                    fillPatternScaleX={props.size / traceTexture.image.width}
                                    fillPatternScaleY={props.size / traceTexture.image.height}
                                    fillPatternOffsetX={0}
                                    fillPatternOffsetY={0}
                                    opacity={0.3}
                                />
                            </Layer>
                        )}
                        <Layer ref={props.drawingLayerRef}>
                            {oldTexture && (
                                <Rect
                                    x={0}
                                    y={0}
                                    width={props.size}
                                    height={props.size}
                                    fillPatternImage={oldTexture.image as HTMLImageElement}
                                    fillPatternRepeat="no-repeat"
                                    fillPatternScaleX={props.size / oldTexture.image.width}
                                    fillPatternScaleY={props.size / oldTexture.image.height}
                                    fillPatternOffsetX={0}
                                    fillPatternOffsetY={0}
                                />
                            )}

                            {layers.map((_layer, i) => {
                                const layer = layers[layers.length - i - 1]
                                if (hiddenLayers[layers.length - i - 1]) return null
                                return layer.map((line, i) => (
                                    <Line
                                        key={i}
                                        points={line.points}
                                        stroke={line.color}
                                        strokeWidth={line.width}
                                        tension={0.5}
                                        lineCap="round"
                                        lineJoin="round"
                                        globalCompositeOperation={
                                            line.tool === 'eraser' ? 'destination-out' : 'source-over'
                                        }
                                    />
                                ))
                            })}
                        </Layer>
                        <Layer ref={previewLayerRef}>
                            <Circle
                                ref={circleRef}
                                radius={width / 2}
                                dash={[2, 2]}
                                strokeWidth={1}
                                visible={false}
                                stroke="gray"
                            />
                        </Layer>
                    </Stage>
                </Box>

                <Box display="flex" flexDirection="column" height={`${props.size}px`} justifyContent="flex-end" gap={1}>
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
                        {hiddenLayers[0] ? (
                            <MdLayersClear color="white" size={24} />
                        ) : (
                            <MdLayers color="white" size={24} />
                        )}
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
                        {hiddenLayers[1] ? (
                            <MdLayersClear color="white" size={24} />
                        ) : (
                            <MdLayers color="white" size={24} />
                        )}
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
                        {hiddenLayers[2] ? (
                            <MdLayersClear color="white" size={24} />
                        ) : (
                            <MdLayers color="white" size={24} />
                        )}
                        3
                    </Box>

                    <TexturePreview
                        texture={traceTexture}
                        sx={{
                            width: '80px',
                            height: '80px',
                            cursor: 'pointer',
                            border: '1px dashed white',
                            borderRadius: '5px'
                        }}
                        onClick={(e) => {
                            setTraceAnchor(e.currentTarget)
                        }}
                    />

                    <Menu
                        anchorEl={traceAnchor}
                        open={Boolean(traceAnchor)}
                        onClose={() => setTraceAnchor(null)}
                        style={{ color: 'white' }}
                        slotProps={{
                            paper: {
                                style: {
                                    maxHeight: `${props.size}px`
                                }
                            }
                        }}
                    >
                        <MenuItem onClick={() => setTraceTexture(undefined)}>None</MenuItem>

                        {props.references &&
                            Object.keys(props.references).map((name) => (
                                <MenuItem key={name} onClick={() => setReferenceByTexture(props.references![name])}>
                                    {name}
                                </MenuItem>
                            ))}

                        <MenuItem onClick={() => setReferenceByName('Head-Front')}>Head Front (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Head-Back')}>Head Back (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Eyes-Closed')}>Eyes Closed (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Mouth-Open')}>Mouth Open (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Body-Front')}>Body Front (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Body-Back')}>Body Back (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Hand-Front')}>Hand Front (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Hand-Back')}>Hand Back (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Legs-Front')}>Legs Front (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Legs-Back')}>Legs Back (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Tail-Front')}>Tail Front (Template)</MenuItem>
                        <MenuItem onClick={() => setReferenceByName('Tail-Back')}>Tail Back (Template)</MenuItem>
                    </Menu>
                </Box>
            </Box>
        </>
    )
}
