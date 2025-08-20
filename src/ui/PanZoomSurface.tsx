import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react'

type Point = { x: number; y: number }

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

/** 画面座標 p を不変に保つズーム時の tx,ty 補正 */
function zoomAround(tx: number, ty: number, s: number, sNext: number, p: Point) {
    const k = sNext / s
    return {
        tx: tx + (1 - k) * (p.x - tx),
        ty: ty + (1 - k) * (p.y - ty)
    }
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
    /** 比率変化がこのしきい値未満ならズームしない（デッドゾーン） */
    pinchThreshold?: number // 0.015 = 1.5%
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
        pinchThreshold = 0.015,
        children
    },
    ref
) {
    // 表示のための state
    const [scale, _setScale] = useState(initialScale)
    const [tx, _setTx] = useState(initialPositionX)
    const [ty, _setTy] = useState(initialPositionY)
    const [isTransforming, setIsTransforming] = useState(false)

    // 実計算のための現在値を保持（クロージャの古い値対策）
    const transformRef = useRef({ scale: initialScale, tx: initialPositionX, ty: initialPositionY })
    const setScale = (v: number) => {
        const vv = clamp(v, minScale, maxScale)
        transformRef.current.scale = vv
        _setScale(vv)
    }
    const setTx = (v: number) => {
        transformRef.current.tx = v
        _setTx(v)
    }
    const setTy = (v: number) => {
        transformRef.current.ty = v
        _setTy(v)
    }

    const containerRef = useRef<HTMLDivElement | null>(null)

    // --- mouse (MMB) ---
    const isMMBPan = useRef(false)
    const lastMouse = useRef<Point | null>(null)

    // --- touch pointers ---
    const activePointers = useRef<Map<number, Point>>(new Map())
    const pinch = useRef<{
        idA: number | null
        idB: number | null
        lastMid: Point | null
        lastSpan: number | null
    }>({ idA: null, idB: null, lastMid: null, lastSpan: null })

    const getRect = () => containerRef.current!.getBoundingClientRect()

    // ref API（常に最新値）
    useImperativeHandle(
        ref,
        () => ({
            get scale() {
                return transformRef.current.scale
            },
            get positionX() {
                return transformRef.current.tx
            },
            get positionY() {
                return transformRef.current.ty
            },
            isTransforming,
            setTransform(next) {
                if (next.scale !== undefined) setScale(next.scale)
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
        [isTransforming, minScale, maxScale, initialScale, initialPositionX, initialPositionY]
    )

    // -------- wheel zoom（isTransforming は触らない） --------
    const onWheel = useCallback(
        (e: React.WheelEvent) => {
            if (!containerRef.current) return
            const rect = getRect()
            const p: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
            const s0 = transformRef.current.scale
            const t0x = transformRef.current.tx
            const t0y = transformRef.current.ty

            const zoomStep = Math.exp(-e.deltaY * 0.0015)
            const s1 = clamp(s0 * zoomStep, minScale, maxScale)
            if (s1 !== s0) {
                const { tx: ntx, ty: nty } = zoomAround(t0x, t0y, s0, s1, p)
                setScale(s1)
                setTx(ntx)
                setTy(nty)
            }
        },
        [minScale, maxScale]
    )

    // -------- pinch helpers --------
    function initPinchPair() {
        if (activePointers.current.size !== 2) return false
        const ids = Array.from(activePointers.current.keys()).sort((a, b) => a - b)
        pinch.current.idA = ids[0]
        pinch.current.idB = ids[1]
        const A = activePointers.current.get(ids[0])!
        const B = activePointers.current.get(ids[1])!
        const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }
        const span = Math.hypot(A.x - B.x, A.y - B.y)
        pinch.current.lastMid = mid
        pinch.current.lastSpan = Math.max(span, 0.0001)
        return true
    }

    // -------- pointer handlers --------
    const onPointerDown = useCallback((e: React.PointerEvent) => {
        ;(e.target as Element).setPointerCapture?.(e.pointerId)

        if (e.pointerType === 'mouse') {
            // 中ボタンのみパン開始
            if (e.button === 1) {
                isMMBPan.current = true
                setIsTransforming(true)
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
                initPinchPair()
                setIsTransforming(true)
                e.preventDefault()
            }
            // 3本目以降は無視（既存ペアは維持）
        }
    }, [])

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!containerRef.current) return

            // --- mouse MMB pan ---
            if (e.pointerType === 'mouse') {
                if (isMMBPan.current && lastMouse.current) {
                    if (e.buttons === 0) {
                        // 離れたのに up が来ない保険
                        isMMBPan.current = false
                        setIsTransforming(false)
                        ;(e.target as Element).releasePointerCapture?.(e.pointerId)
                        return
                    }
                    const dx = e.clientX - lastMouse.current.x
                    const dy = e.clientY - lastMouse.current.y
                    setTx(transformRef.current.tx + dx)
                    setTy(transformRef.current.ty + dy)
                    lastMouse.current = { x: e.clientX, y: e.clientY }
                    e.preventDefault()
                }
                return
            }

            // --- touch (2本指) ---
            if (e.pointerType === 'touch') {
                const rect = getRect()
                if (!activePointers.current.has(e.pointerId)) return
                activePointers.current.set(e.pointerId, {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                })

                if (activePointers.current.size < 2) return

                // 現在の2本ID
                const idsNow = Array.from(activePointers.current.keys()).sort((a, b) => a - b)
                const { idA, idB, lastMid, lastSpan } = pinch.current

                // ペア未確定 or 変化 → 再初期化（基準リセット）
                if (idA === null || idB === null || idA !== idsNow[0] || idB !== idsNow[1] || !lastMid || !lastSpan) {
                    initPinchPair()
                    return
                }

                const A = activePointers.current.get(idA)!
                const B = activePointers.current.get(idB)!
                const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }
                const span = Math.max(Math.hypot(A.x - B.x, A.y - B.y), 0.0001)

                // --- パン（mid 移動量）
                const mdx = mid.x - lastMid.x
                const mdy = mid.y - lastMid.y
                if (mdx || mdy) {
                    setTx(transformRef.current.tx + mdx)
                    setTy(transformRef.current.ty + mdy)
                }

                // --- ズーム（デッドゾーンあり）
                const ratioRaw = span / lastSpan
                const ratioDelta = Math.abs(ratioRaw - 1)
                if (ratioDelta > pinchThreshold) {
                    // 1イベントの暴れ抑制（上限/下限）
                    const ratio = clamp(ratioRaw, 0.5, 2.0)
                    const s0 = transformRef.current.scale
                    const s1 = clamp(s0 * ratio, minScale, maxScale)
                    if (s1 !== s0) {
                        const { tx: ntx, ty: nty } = zoomAround(
                            transformRef.current.tx,
                            transformRef.current.ty,
                            s0,
                            s1,
                            mid
                        )
                        setScale(s1)
                        setTx(ntx)
                        setTy(nty)
                    }
                }

                // 次回基準を更新
                pinch.current.lastMid = mid
                pinch.current.lastSpan = span

                e.preventDefault()
            }
        },
        [minScale, maxScale, pinchThreshold]
    )

    const endTouchMaybe = useCallback((pointerId: number) => {
        activePointers.current.delete(pointerId)
        const { idA, idB } = pinch.current
        if (pointerId === idA || pointerId === idB) {
            // アクティブペアが崩れたらクリア
            pinch.current.idA = pinch.current.idB = null
            pinch.current.lastMid = pinch.current.lastSpan = null
        }
        if (activePointers.current.size < 2) {
            setIsTransforming(false)
        }
    }, [])

    const onPointerUp = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerType === 'mouse') {
                if (isMMBPan.current && (e.button === 1 || e.buttons === 0)) {
                    isMMBPan.current = false
                    lastMouse.current = null
                    setIsTransforming(false)
                    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
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
                if (isMMBPan.current) {
                    isMMBPan.current = false
                    lastMouse.current = null
                    setIsTransforming(false)
                    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
                }
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
            isMMBPan.current = false
            lastMouse.current = null
            setIsTransforming(false)
            ;(e.target as Element).releasePointerCapture?.(e.pointerId)
        }
    }, [])

    // blur 保険
    useEffect(() => {
        const onBlur = () => {
            isMMBPan.current = false
            lastMouse.current = null
            pinch.current.idA = pinch.current.idB = null
            pinch.current.lastMid = pinch.current.lastSpan = null
            activePointers.current.clear()
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
