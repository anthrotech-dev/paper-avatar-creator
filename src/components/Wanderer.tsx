import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Euler, Group, MathUtils, Vector3 } from 'three'

// ====== XZ 平面ランダム徘徊コンポーネント ======
interface WandererProps {
    children: React.ReactNode
    initial: [number, number, number]
    bounds?: number
    baseSpeed?: number
}

export function Wanderer({ children, initial, bounds = 20, baseSpeed = 1.2 }: WandererProps) {
    const group = useRef<Group>(null)

    // 個体ごとの乱数シード
    /*
  const seed = useMemo(() => Math.random() * 10000, []);
  const rand = (min: number, max: number) => min + (max - min) * fract(Math.sin(seed + performance.now() * 0.00001) * 43758.5453123);
  function fract(x: number) {
    return x - Math.floor(x);
  }
  */

    // 現在の目標地点・速度などの内部状態
    const state = useRef({
        target: new Vector3(MathUtils.randFloatSpread(bounds * 2), 0, MathUtils.randFloatSpread(bounds * 2)),
        vel: new Vector3(),
        speed: baseSpeed * MathUtils.randFloat(0.8, 1.2)
    })

    // 初期位置設定
    const start = useMemo(() => new Vector3(...initial), [initial])

    useFrame((_, dt) => {
        const g = group.current
        if (!g) return

        // 位置ベクトル
        const pos = g.position as Vector3
        if (pos.y !== 0) pos.y = 0 // 地面に固定

        // ゴールに近づいたら再設定
        const toTarget = state.current.target.clone().sub(pos)
        const dist = toTarget.length()
        if (dist < 0.25) {
            state.current.target.set(MathUtils.randFloatSpread(bounds * 2), 0, MathUtils.randFloatSpread(bounds * 2))
            // 速度微調整: 人によって少し違う
            state.current.speed = baseSpeed * MathUtils.randFloat(0.9, 1.3)
            return // 次フレームから移動
        }

        // 方向と速度
        const dir = toTarget.normalize()
        const maxStep = state.current.speed * dt // 移動量(m)

        // 平滑回頭: 現向き(Yaw) -> 目標方向 へ補間
        const desiredYaw = Math.atan2(dir.x, dir.z) // +x 右, +z 前
        const euler = new Euler().setFromQuaternion(g.quaternion, 'YXZ')
        const currentYaw = euler.y
        const turnRate = 3.0 // 大きいほどクイックに向きを変える
        const newYaw = MathUtils.lerp(currentYaw, desiredYaw, MathUtils.clamp(turnRate * dt, 0, 1))
        g.quaternion.setFromEuler(new Euler(0, newYaw, 0))

        // 前進
        const forward = new Vector3(0, 0, 1).applyQuaternion(g.quaternion)
        pos.addScaledVector(forward, maxStep)

        // 境界の外に出そうなら反転気味に次ターゲットを振る
        if (Math.abs(pos.x) > bounds || Math.abs(pos.z) > bounds) {
            state.current.target.set(
                MathUtils.clamp(pos.x, -bounds + 0.5, bounds - 0.5) * -0.8,
                0,
                MathUtils.clamp(pos.z, -bounds + 0.5, bounds - 0.5) * -0.8
            )
        }
    })

    return (
        <group ref={group} position={start} castShadow>
            {children}
        </group>
    )
}
