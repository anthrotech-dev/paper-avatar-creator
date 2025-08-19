
import { Box } from '@mui/material';
import { useEffect, useRef, useState } from 'react'

import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

const MAX_HISTORY = 30;

type PainterProps = {
    width: number
    height: number
}

export function Painter(props: PainterProps) {

    const [tool, setTool] = useState<'brush' | 'eraser' | 'fill'>('brush');

    const historyRef = useRef<ImageData[]>([]);
    const redoRef    = useRef<ImageData[]>([]);

    const [brushSize, setBrushSize] = useState<number>(32);

    const [color, setColor] = useState<string>('#000000');
    const [alpha, setAlpha] = useState<number>(1.0);

    const [hardness, setHardness] = useState<number>(0.5);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const brushRef   = useRef<HTMLCanvasElement>(null);
    const [drawing, setDrawing] = useState(false);
    const prevPos = useRef<[number, number] | null>(null);
    const leftoverRef = useRef(0)

    const transform = useRef<{
        scale: number,
        positionX: number,
        positionY: number
    }>({
        scale: 1,
        positionX: 0,
        positionY: 0
    });

    useEffect(() => {
        let b = brushRef.current
        if (!b) {
            brushRef.current = b = document.createElement('canvas');
        }
        b.width = b.height = brushSize;
        const g = b.getContext('2d')!;
        const r = brushSize / 2;
        const grad = g.createRadialGradient(r, r, 0, r, r, r);
        const alphaColor = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        grad.addColorStop(0, alphaColor);
        grad.addColorStop(hardness, alphaColor);
        grad.addColorStop(1, `${color}00`);
        g.fillStyle = grad;
        g.fillRect(0, 0, brushSize, brushSize);
        brushRef.current = b;
    }, [brushSize, color, hardness, alpha]);

    const stamp = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
        const r = brushSize / 2;
        ctx.save();
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.drawImage(brushRef.current!, x - r, y - r);
        ctx.restore();
    };

    const bucketFill = (sx: number, sy: number) => {
        const ctx = canvasRef.current!.getContext('2d')!;
        const fill = color.replace('#', '').match(/../g)!.map(c => parseInt(c, 16));
        fill.push(Math.round(alpha * 255)); // アルファ値を追加
        console.log('fill', color, alpha, fill);
        sx |= 0; sy |= 0;                         // 小数対策
        const { width: W, height: H } = ctx.canvas;

        const img = ctx.getImageData(0, 0, W, H);
        const buf32 = new Uint32Array(img.data.buffer);   // BGRA リトルエンディアン

        const toUint32 = ([r, g, b, a]: number[]) =>
            (a << 24) | (b << 16) | (g << 8) | r;

        const target = buf32[sy * W + sx];
        const fill32 = toUint32(fill);

        if (target === fill32) return;            // 既に同色なら何もしない

        const stack: [number, number][] = [[sx, sy]];

        const tot   = W * H;
        const visited = new Uint8Array(Math.ceil(tot / 8));

        const isVisited = (i: number) => (visited[i>>3] & (1 << (i & 7))) !== 0;
        const setVisited= (i: number) => { visited[i>>3] |= (1 << (i & 7)); };

        while (stack.length) {
            let [x, y] = stack.pop()!;
            let pos = y * W + x;

            /* ① 上へ伸ばす */
            while (y > 0 && buf32[pos - W] === target) {
                y--; pos -= W;
            }

            /* ② 下へ走査しながら左右をキューに積む */
            let spanLeft = false, spanRight = false;
            while (y < H && buf32[pos] === target && !isVisited(pos)) {
                buf32[pos] = fill32; // 塗り
                setVisited(pos);

                // 左チェック
                if (x > 0) {
                    if (buf32[pos - 1] === target) {
                    if (!spanLeft) { stack.push([x - 1, y]); spanLeft = true; }
                    } else spanLeft = false;
                }

                // 右チェック
                if (x < W - 1) {
                    if (buf32[pos + 1] === target) {
                    if (!spanRight) { stack.push([x + 1, y]); spanRight = true; }
                    } else spanRight = false;
                }

                y++;
                pos += W; // 下へ 1 ピクセル
            }
        }

        ctx.putImageData(img, 0, 0);
    }


    const handlePointerMove = (e: React.PointerEvent) => {
        if (!drawing) return;
        // only handle left mouse button
        if (e.buttons !== 1) return;

        const rect = canvasRef.current!.getBoundingClientRect();
        const x = (e.clientX - rect.left) / transform.current.scale;
        const y = (e.clientY - rect.top) / transform.current.scale;

        const ctx = canvasRef.current!.getContext('2d')!;
        const spacing = brushSize * 0.1;

        if (prevPos.current) {
            let [px, py] = prevPos.current;
            let dx = x - px, dy = y - py;
            let dist = Math.hypot(dx, dy);

            // ① 余り距離を加算
            dist += leftoverRef.current;

            // ② ベクトル正規化（0 除算防止）
            const ux = dx === 0 && dy === 0 ? 0 : dx / Math.hypot(dx, dy);
            const uy = dy === 0 && dx === 0 ? 0 : dy / Math.hypot(dx, dy);

            // ③ 等間隔でスタンプ
            while (dist >= spacing) {
                px += ux * spacing;
                py += uy * spacing;
                stamp(ctx, px, py);
                dist -= spacing;
            }

            // ④ 余った距離を保存
            leftoverRef.current = dist;
            prevPos.current = [px, py];
        } else {
            stamp(ctx, x, y);
            leftoverRef.current = 0;
            prevPos.current = [x, y];
        }
    };

    const pushHistory = () => {
        const ctx = canvasRef.current!.getContext('2d')!;
        historyRef.current.push(ctx.getImageData(0, 0, props.width, props.height));
        if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
        redoRef.current.length = 0; // 新操作したら Redo クリア
    };

    const undo = () => {
        if (!historyRef.current.length) return;
        const ctx = canvasRef.current!.getContext('2d')!;
        const img = historyRef.current.pop()!;
        redoRef.current.push(ctx.getImageData(0, 0, props.width, props.height));
        ctx.putImageData(img, 0, 0);
    };
    const redo = () => {
        if (!redoRef.current.length) return;
        const ctx = canvasRef.current!.getContext('2d')!;
        const img = redoRef.current.pop()!;
        historyRef.current.push(ctx.getImageData(0, 0, props.width, props.height));
        ctx.putImageData(img, 0, 0);
    };

    return <Box
        width={'100%'}
        height={'100%'}
        position={'relative'}
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
                transform.current = { scale, positionX, positionY };
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
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        width={props.width}
                        height={props.height}
                        style={{ touchAction: 'none' }}
                        onPointerDown={e => { 
                            pushHistory();

                            if (tool === 'fill') {
                                const rect = canvasRef.current!.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const y = e.clientY - rect.top;
                                bucketFill(x, y);
                            } else {
                                setDrawing(true);
                                prevPos.current = null; // 前の位置をリセット
                                handlePointerMove(e);
                            }
                        }}
                        onPointerMove={handlePointerMove}
                        onPointerUp={() => { 
                            setDrawing(false);
                            prevPos.current = null; // 描画終了時に前の位置をリセット
                        }}
                        onPointerLeave={() => {
                            setDrawing(false);
                            prevPos.current = null; // キャンバスから離れた時に前の位置をリセット
                        }}
                    />
                </Box>
            </TransformComponent>
        </TransformWrapper>


        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'absolute',
                top: 0,
                left: 0,
            }}
        >

            <button onClick={undo}>
                Undo
            </button>

            <button onClick={redo}>
                Redo
            </button>

            <button onClick={() => setTool('brush')}>
                Brush
            </button>
            <button onClick={() => setTool('eraser')}>
                Eraser
            </button>
            <button onClick={() => setTool('fill')}>
                Fill
            </button>

            <input
                type="range"
                min="8"
                max="128"
                value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))}
            />
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={hardness}
                onChange={e => setHardness(Number(e.target.value))}
            />
            <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
            />
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={alpha}
                onChange={e => setAlpha(Number(e.target.value))}
            />
            <button
                onClick={() => {
                    const ctx = canvasRef.current!.getContext('2d')!;
                    ctx.clearRect(0, 0, props.width, props.height);
                }}
            >
                Clear
            </button>
        </div>
    </Box>

}
