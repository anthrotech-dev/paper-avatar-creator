import React, { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'

type Point = { x: number; y: number }

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

function zoomAround(tx: number, ty: number, s: number, sNext: number, p: Point): { tx: number; ty: number } {
    const k = sNext / s
    return {
        tx: tx + (1 - k) * (p.x - tx),
        ty: ty + (1 - k) * (p.y - ty)
    }
}

export interface PanZoomTransform {
    scale: number
    positionX: number
    positionY: number
}

export type TransformReason = 'mouse-pan' | 'touch-pinch' | 'wheel-zoom'

export interface PanZoomSurfaceProps {
    className?: string
    width?: number | string
    height?: number | string
    minScale?: number
    maxScale?: number
    initialScale?: number
    initialPositionX?: number
    initialPositionY?: number

    /** ホイール終了と見なす無入力時間(ms) */
    wheelEndDelay?: number

    /** 変換が開始されたとき（開始ごとに1回） */
    onTransformBegin?: (reason: TransformReason) => void
    /** 変換が終了したとき（終了ごとに1回） */
    onTransformEnd?: (reason: TransformReason) => void
    /** 変換が確定したとき（＝終了時のみ） */
    onTransformed?: (e: Event | null, state: PanZoomTransform, reason: TransformReason) => void

    children?: React.ReactNode
}

export interface PanZoomHandle {
    /** 現在ユーザー操作によるトランスフォーム中か */
    isTransforming: boolean
    /** 現在のトランスフォーム値取得 */
    getTransform(): PanZoomTransform
    /** 明示的にセット（ユーザー操作イベントは発火しない） */
    setTransform(next: Partial<PanZoomTransform>): void
    /** 初期値にリセット */
    reset(): void
}

export const PanZoomSurface = forwardRef<PanZoomHandle, PanZoomSurfaceProps>(function PanZoomSurface(
    {
        className,
        width = '100%',
        height = '100%',
        minScale = 0.2,
        maxScale = 8,
        initialScale = 1,
        initialPositionX = 0,
        initialPositionY = 0,
        wheelEndDelay = 180,
        onTransformBegin,
        onTransformEnd,
        onTransformed,
        children
    },
    ref
) {
    const [scale, setScale] = useState(initialScale)
    const [tx, setTx] = useState(initialPositionX)
    const [ty, setTy] = useState(initialPositionY)

    const containerRef = useRef<HTMLDivElement | null>(null)

    // ---- 内部状態・フラグ ----
    const transforming = useRef<TransformReason | null>(null)
    const isMMBPan = useRef(false)
    const lastMouse = useRef<Point | null>(null)

    const activePointers = useRef<Map<number, Point>>(new Map())
    const pinchLastMid = useRef<Point | null>(null)
    const pinchLastDist = useRef<number | null>(null)

    const wheelTimer = useRef<number | null>(null)

    const getRect = () => containerRef.current!.getBoundingClientRect()

    // ---- ref API ----
    useImperativeHandle(ref, () => ({
        get isTransforming() {
            return transforming.current !== null
        },
        getTransform() {
            return { scale, positionX: tx, positionY: ty }
        },
        setTransform(next) {
            if (next.scale !== undefined) {
                setScale(clamp(next.scale, minScale, maxScale))
            }
            if (next.positionX !== undefined) setTx(next.positionX)
            if (next.positionY !== undefined) setTy(next.positionY)
        },
        reset() {
            setScale(initialScale)
            setTx(initialPositionX)
            setTy(initialPositionY)
        }
    }))

    // ---- begin/end ユーティリティ ----
    const beginIfNeeded = (reason: TransformReason) => {
        if (transforming.current == null) {
            transforming.current = reason
            onTransformBegin?.(reason)
        }
    }
    const endIfNeeded = (reason: TransformReason, ev: Event | null) => {
        if (transforming.current === reason) {
            onTransformEnd?.(reason)
            onTransformed?.(ev, { scale, positionX: tx, positionY: ty }, reason)
            transforming.current = null
        }
    }

    // ---- Wheel Zoom ----
    const onWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault()
            if (!containerRef.current) return

            // ホイールは連続イベント：最初の入力で begin、最後の入力から一定時間で end
            beginIfNeeded('wheel-zoom')

            const rect = getRect()
            const p: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top }

            const zoomStep = Math.exp(-e.deltaY * 0.0015)
            const nextScale = clamp(scale * zoomStep, minScale, maxScale)
            if (nextScale !== scale) {
                const { tx: ntx, ty: nty } = zoomAround(tx, ty, scale, nextScale, p)
                setScale(nextScale)
                setTx(ntx)
                setTy(nty)
            }

            // 終了検知のリセット
            if (wheelTimer.current) window.clearTimeout(wheelTimer.current)
            wheelTimer.current = window.setTimeout(() => {
                endIfNeeded('wheel-zoom', e.nativeEvent)
            }, wheelEndDelay)
        },
        [scale, tx, ty, minScale, maxScale, wheelEndDelay]
    )

    // ---- Pointer ----
    const onPointerDown = useCallback((e: React.PointerEvent) => {
        ;(e.target as Element).setPointerCapture?.(e.pointerId)

        if (e.pointerType === 'mouse') {
            if (e.button === 1) {
                // 中ボタンドラッグ開始
                beginIfNeeded('mouse-pan')
                isMMBPan.current = true
                lastMouse.current = { x: e.clientX, y: e.clientY }
                e.preventDefault()
            }
            return
        }

        if (e.pointerType === 'touch') {
            const rect = getRect()
            activePointers.current.set(e.pointerId, {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            })
            if (activePointers.current.size === 2) {
                // ピンチ開始
                const pts = [...activePointers.current.values()]
                const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
                const dx = pts[0].x - pts[1].x
                const dy = pts[0].y - pts[1].y
                pinchLastMid.current = mid
                pinchLastDist.current = Math.hypot(dx, dy)
                beginIfNeeded('touch-pinch')
                e.preventDefault()
            }
        }
    }, [])

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!containerRef.current) return

            if (e.pointerType === 'mouse') {
                if (isMMBPan.current && lastMouse.current) {
                    const dx = e.clientX - lastMouse.current.x
                    const dy = e.clientY - lastMouse.current.y
                    setTx((t) => t + dx)
                    setTy((t) => t + dy)
                    lastMouse.current = { x: e.clientX, y: e.clientY }
                    e.preventDefault()
                }
                return
            }

            if (e.pointerType === 'touch') {
                const rect = getRect()
                if (!activePointers.current.has(e.pointerId)) return
                activePointers.current.set(e.pointerId, {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                })

                if (activePointers.current.size === 2 && pinchLastMid.current && pinchLastDist.current) {
                    const pts = [...activePointers.current.values()]
                    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
                    const dx = pts[0].x - pts[1].x
                    const dy = pts[0].y - pts[1].y
                    const dist = Math.hypot(dx, dy)

                    // パン
                    const mdx = mid.x - pinchLastMid.current.x
                    const mdy = mid.y - pinchLastMid.current.y
                    if (mdx || mdy) {
                        setTx((t) => t + mdx)
                        setTy((t) => t + mdy)
                    }

                    // ズーム
                    const ratio = dist / pinchLastDist.current
                    if (ratio !== 1) {
                        setScale((s) => {
                            const next = clamp(s * ratio, minScale, maxScale)
                            if (next === s) return s
                            const { tx: ntx, ty: nty } = zoomAround(tx, ty, s, next, mid)
                            setTx(ntx)
                            setTy(nty)
                            return next
                        })
                    }

                    pinchLastMid.current = mid
                    pinchLastDist.current = dist
                    e.preventDefault()
                }
            }
        },
        [minScale, maxScale, tx, ty]
    )

    const endTouchMaybe = useCallback((pointerId: number, ev: Event | null) => {
        activePointers.current.delete(pointerId)
        if (activePointers.current.size < 2) {
            // ピンチ終了
            pinchLastMid.current = null
            pinchLastDist.current = null
            endIfNeeded('touch-pinch', ev)
        }
    }, [])

    const onPointerUp = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerType === 'mouse') {
                if (e.button === 1) {
                    isMMBPan.current = false
                    lastMouse.current = null
                    endIfNeeded('mouse-pan', e.nativeEvent)
                }
                return
            }
            if (e.pointerType === 'touch') {
                endTouchMaybe(e.pointerId, e.nativeEvent)
            }
        },
        [endTouchMaybe]
    )

    const onPointerCancel = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerType === 'mouse') {
                isMMBPan.current = false
                lastMouse.current = null
                endIfNeeded('mouse-pan', e.nativeEvent)
                return
            }
            if (e.pointerType === 'touch') {
                endTouchMaybe(e.pointerId, e.nativeEvent)
            }
        },
        [endTouchMaybe]
    )

    // アンマウント時のクリーンアップ（ホイール終了通知が残らないよう）
    useEffect(() => {
        return () => {
            if (wheelTimer.current) window.clearTimeout(wheelTimer.current)
        }
    }, [])

    return (
        <div
            ref={containerRef}
            className={className}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            style={{
                position: 'relative',
                overflow: 'hidden',
                touchAction: 'none', // ジェスチャは自前制御
                userSelect: 'none',
                width,
                height
            }}
        >
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    willChange: 'transform'
                }}
            >
                {children}
            </div>
        </div>
    )
})
