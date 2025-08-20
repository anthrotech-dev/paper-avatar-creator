import React, { useRef, useState, useCallback, useEffect } from 'react'

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

export interface PanZoomSurfaceProps {
    className?: string
    width?: number
    height?: number
    minScale?: number
    maxScale?: number
    initialScale?: number
    /** 初期位置 */
    initialPositionX?: number
    initialPositionY?: number
    /** 変換が更新されたときの通知 */
    onTransformed?: (e: Event | null, state: { scale: number; positionX: number; positionY: number }) => void
    children?: React.ReactNode
}

export function PanZoomSurface({
    className,
    width,
    height,
    minScale = 0.2,
    maxScale = 8,
    initialScale = 1,
    initialPositionX = 0,
    initialPositionY = 0,
    onTransformed,
    children
}: PanZoomSurfaceProps) {
    const [scale, setScale] = useState(initialScale)
    const [tx, setTx] = useState(initialPositionX)
    const [ty, setTy] = useState(initialPositionY)

    const containerRef = useRef<HTMLDivElement | null>(null)

    const isMMBPan = useRef(false)
    const lastMouse = useRef<Point | null>(null)

    const activePointers = useRef<Map<number, Point>>(new Map())
    const pinchLastMid = useRef<Point | null>(null)
    const pinchLastDist = useRef<number | null>(null)

    const getRect = () => containerRef.current!.getBoundingClientRect()

    /** transform更新時にコールバック呼び出し */
    useEffect(() => {
        onTransformed?.(null, { scale, positionX: tx, positionY: ty })
    }, [scale, tx, ty, onTransformed])

    const onWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault()
            if (!containerRef.current) return
            const rect = getRect()
            const p: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top }

            const zoomStep = Math.exp(-e.deltaY * 0.0015)
            const nextScale = clamp(scale * zoomStep, minScale, maxScale)
            if (nextScale === scale) return

            const { tx: ntx, ty: nty } = zoomAround(tx, ty, scale, nextScale, p)
            setScale(nextScale)
            setTx(ntx)
            setTy(nty)
            onTransformed?.(e.nativeEvent, { scale: nextScale, positionX: ntx, positionY: nty })
        },
        [scale, tx, ty, minScale, maxScale, onTransformed]
    )

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        ;(e.target as Element).setPointerCapture?.(e.pointerId)

        if (e.pointerType === 'mouse') {
            if (e.button === 1) {
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
                const pts = [...activePointers.current.values()]
                const mid = {
                    x: (pts[0].x + pts[1].x) / 2,
                    y: (pts[0].y + pts[1].y) / 2
                }
                const dx = pts[0].x - pts[1].x
                const dy = pts[0].y - pts[1].y
                pinchLastMid.current = mid
                pinchLastDist.current = Math.hypot(dx, dy)
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
                    setTx((t) => {
                        const next = t + dx
                        onTransformed?.(e.nativeEvent, { scale, positionX: next, positionY: ty + dy })
                        return next
                    })
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

                if (activePointers.current.size === 2) {
                    const pts = [...activePointers.current.values()]
                    const mid = {
                        x: (pts[0].x + pts[1].x) / 2,
                        y: (pts[0].y + pts[1].y) / 2
                    }
                    const dx = pts[0].x - pts[1].x
                    const dy = pts[0].y - pts[1].y
                    const dist = Math.hypot(dx, dy)

                    if (pinchLastMid.current && pinchLastDist.current) {
                        const mdx = mid.x - pinchLastMid.current.x
                        const mdy = mid.y - pinchLastMid.current.y
                        if (mdx !== 0 || mdy !== 0) {
                            setTx((t) => {
                                const next = t + mdx
                                onTransformed?.(e.nativeEvent, { scale, positionX: next, positionY: ty + mdy })
                                return next
                            })
                            setTy((t) => ty + mdy)
                        }

                        const ratio = dist / pinchLastDist.current
                        if (ratio !== 1) {
                            setScale((s) => {
                                const next = clamp(s * ratio, minScale, maxScale)
                                if (next === s) return s
                                const { tx: ntx, ty: nty } = zoomAround(tx, ty, s, next, mid)
                                setTx(ntx)
                                setTy(nty)
                                onTransformed?.(e.nativeEvent, { scale: next, positionX: ntx, positionY: nty })
                                return next
                            })
                        }
                    }
                    pinchLastMid.current = mid
                    pinchLastDist.current = dist
                    e.preventDefault()
                }
            }
        },
        [scale, tx, ty, minScale, maxScale, onTransformed]
    )

    const endTouchMaybe = useCallback((pointerId: number) => {
        activePointers.current.delete(pointerId)
        if (activePointers.current.size < 2) {
            pinchLastMid.current = null
            pinchLastDist.current = null
        }
    }, [])

    const onPointerUp = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerType === 'mouse') {
                if (e.button === 1) {
                    isMMBPan.current = false
                    lastMouse.current = null
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
                isMMBPan.current = false
                lastMouse.current = null
                return
            }
            if (e.pointerType === 'touch') {
                endTouchMaybe(e.pointerId)
            }
        },
        [endTouchMaybe]
    )

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
                touchAction: 'none',
                userSelect: 'none',
                width: '100%',
                height: '100%'
            }}
        >
            <div
                style={{
                    width: width ?? '100%',
                    height: height ?? '100%',
                    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    willChange: 'transform'
                }}
            >
                {children}
            </div>
        </div>
    )
}
