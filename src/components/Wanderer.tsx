import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Euler, Group, MathUtils, Vector3 } from 'three'

interface WandererProps {
    children: React.ReactNode
    initial: [number, number, number]
    bounds?: number
    baseSpeed?: number
    /** 到達後の休憩時間の範囲(秒) */
    restRange?: [number, number]
}

type Mode = 'idle' | 'move'

export function Wanderer({ children, initial, bounds = 20, baseSpeed = 1.2, restRange = [0.6, 2.0] }: WandererProps) {
    const group = useRef<Group>(null)

    const start = useMemo(() => new Vector3(...initial), [initial])

    const state = useRef({
        mode: 'idle' as Mode,
        target: new Vector3(), // 次に向かう座標
        speed: baseSpeed, // セグメントごとの指示速度
        rest: MathUtils.randFloat(...restRange), // idle の残り秒数
        segStart: start.clone(), // セグメント開始位置
        segLength: 1 // 開始時のターゲットまでの距離
    })

    // 次のターゲットを決める & 速度をランダム化
    const planNext = (from: Vector3) => {
        state.current.target.set(MathUtils.randFloatSpread(bounds * 2), 0, MathUtils.randFloatSpread(bounds * 2))
        state.current.speed = baseSpeed * MathUtils.randFloat(0.85, 1.4) // セグメントごとに速度を変える
        state.current.segStart.copy(from)
        state.current.segLength = Math.max(0.001, state.current.target.distanceTo(from))
        state.current.mode = 'move'
    }

    useFrame((_, dt) => {
        const g = group.current
        if (!g) return

        const pos = g.position as Vector3
        if (pos.y !== 0) pos.y = 0

        // --- IDLE（休憩） ---
        if (state.current.mode === 'idle') {
            state.current.rest -= dt
            if (state.current.rest <= 0) {
                // 次の移動を計画
                planNext(pos)
            }
            return
        }

        // --- MOVE（移動） ---
        const toTarget = state.current.target.clone().sub(pos)
        const dist = toTarget.length()

        // 目的地に十分近ければ休憩に入る
        if (dist < 0.25) {
            state.current.mode = 'idle'
            state.current.rest = MathUtils.randFloat(...restRange)
            return
        }

        // 進行方向
        const dir = toTarget.normalize()

        // ヨーだけスムーズに追従
        const desiredYaw = Math.atan2(dir.x, dir.z)
        const euler = new Euler().setFromQuaternion(g.quaternion, 'YXZ')
        const currentYaw = euler.y
        const turnRate = 3.0
        const newYaw = MathUtils.lerp(currentYaw, desiredYaw, MathUtils.clamp(turnRate * dt, 0, 1))
        g.quaternion.setFromEuler(new Euler(0, newYaw, 0))

        // セグメント内の進捗 0..1
        const progress = 1 - dist / state.current.segLength

        // 加減速のイージング（smoothstep）
        const ease = progress * progress * (3 - 2 * progress) // smoothstep(0,1,p)
        // ほんの少しのゆらぎ（足取りの不均一さ）
        const wobble = 0.9 + 0.2 * Math.sin(progress * Math.PI * 2 + 7.0)

        const actualSpeed = state.current.speed * (0.6 + 0.6 * ease) * wobble
        const maxStep = actualSpeed * dt

        // 外へ出てしまっているときは、瞬時に振り返る
        if (Math.abs(pos.x) > bounds || Math.abs(pos.z) > bounds) {
            g.quaternion.setFromEuler(new Euler(0, Math.atan2(dir.x, dir.z), 0))
        }

        // 前方方向に進める
        const forward = new Vector3(0, 0, 1).applyQuaternion(g.quaternion)
        pos.addScaledVector(forward, maxStep)
    })

    return (
        <group ref={group} position={start} castShadow>
            {children}
        </group>
    )
}
