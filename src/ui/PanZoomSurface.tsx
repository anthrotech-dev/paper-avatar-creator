import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react'

type Point = { x: number; y: number }

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

function zoomAround(tx: number, ty: number, s: number, sNext: number, p: Point): { tx: number; ty: number } {
    const k = sNext / s
    return { tx: tx + (1 - k) * (p.x - tx), ty: ty + (1 - k) * (p.y - ty) }
}

export interface PanZoomSurfaceProps {
    className?: string
    width?: number | string
    height?: number | string
    minScale?: number
    maxScale?: number
    initialScale?: number
    initialPositionX?: number
    initialPositionY?: number
    children?: React.ReactNode
}

export interface PanZoomHandle {
    scale: number
    positionX: number
    positionY: number
    isTransforming: boolean
    setTransform(next: Partial<{ scale: number; positionX: number; positionY: number }>): void
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
        children
    },
    ref
) {
    const [scale, setScale] = useState(initialScale)
    const [tx, setTx] = useState(initialPositionX)
    const [ty, setTy] = useState(initialPositionY)
    const [isTransforming, setIsTransforming] = useState(false)

    const containerRef = useRef<HTMLDivElement | null>(null)
    const isMMBPan = useRef(false)
    const lastMouse = useRef<Point | null>(null)

    const activePointers = useRef<Map<number, Point>>(new Map())
    const pinchLastMid = useRef<Point | null>(null)
    const pinchLastDist = useRef<number | null>(null)

    const getRect = () => containerRef.current!.getBoundingClientRect()

    // ref API（最新の値を常に参照できるよう依存に state を含める）
    useImperativeHandle(
        ref,
        () => ({
            scale,
            positionX: tx,
            positionY: ty,
            isTransforming,
            setTransform(next) {
                if (next.scale !== undefined) setScale(clamp(next.scale, minScale, maxScale))
                if (next.positionX !== undefined) setTx(next.positionX)
                if (next.positionY !== undefined) setTy(next.positionY)
            },
            reset() {
                setScale(initialScale)
                setTx(initialPositionX)
                setTy(initialPositionY)
                setIsTransforming(false)
            }
        }),
        [scale, tx, ty, isTransforming, minScale, maxScale, initialScale, initialPositionX, initialPositionY]
    )

    // Wheel: isTransforming は触らない（要求どおり）
    const onWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault()
            if (!containerRef.current) return
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
        },
        [scale, tx, ty, minScale, maxScale]
    )

    // 中ボタンパン開始/終了
    const beginMMBPan = (e: React.PointerEvent) => {
        isMMBPan.current = true
        setIsTransforming(true)
        lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    const endMMBPan = (e?: React.PointerEvent) => {
        isMMBPan.current = false
        lastMouse.current = null
        setIsTransforming(false)
        if (e) (e.target as Element).releasePointerCapture?.(e.pointerId)
    }

    // Pointer down
    const onPointerDown = useCallback((e: React.PointerEvent) => {
        ;(e.target as Element).setPointerCapture?.(e.pointerId)

        if (e.pointerType === 'mouse') {
            if (e.button === 1) {
                beginMMBPan(e)
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
                const pts = [...activePointers.current.values()]
                const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
                const dx = pts[0].x - pts[1].x
                const dy = pts[0].y - pts[1].y
                pinchLastMid.current = mid
                pinchLastDist.current = Math.hypot(dx, dy)
                setIsTransforming(true)
                e.preventDefault()
            }
        }
    }, [])

    // Pointer move
    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!containerRef.current) return

            if (e.pointerType === 'mouse') {
                if (isMMBPan.current && lastMouse.current) {
                    // 途中で中ボタンが離れたのに up が来ないケース
                    if (e.buttons === 0) {
                        endMMBPan(e)
                        return
                    }
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

    // Pointer up/cancel/leave（終了時のみ state 更新）
    const endTouchMaybe = useCallback((pointerId: number) => {
        activePointers.current.delete(pointerId)
        if (activePointers.current.size < 2) {
            pinchLastMid.current = null
            pinchLastDist.current = null
            setIsTransforming(false)
        }
    }, [])

    const onPointerUp = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerType === 'mouse') {
                if (isMMBPan.current && (e.button === 1 || e.buttons === 0)) {
                    endMMBPan(e)
                }
                return
            }
            if (e.pointerType === 'touch') {
                endTouchMaybe(e.pointerId)
            }
        },
        [endTouchMaybe]
    )

    const onPointerCancel = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerType === 'mouse') {
                if (isMMBPan.current) endMMBPan(e)
                return
            }
            if (e.pointerType === 'touch') {
                endTouchMaybe(e.pointerId)
            }
        },
        [endTouchMaybe]
    )

    const onPointerLeave = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && isMMBPan.current) {
            endMMBPan(e)
        }
    }, [])

    // Window blur で強制終了
    useEffect(() => {
        const onBlur = () => {
            if (isMMBPan.current) {
                isMMBPan.current = false
            }
            lastMouse.current = null
            setIsTransforming(false)
        }
        window.addEventListener('blur', onBlur)
        return () => window.removeEventListener('blur', onBlur)
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
            onPointerLeave={onPointerLeave}
            onContextMenu={(e) => {
                if (isMMBPan.current) e.preventDefault()
            }}
            style={{
                position: 'relative',
                overflow: 'hidden',
                touchAction: 'none',
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
