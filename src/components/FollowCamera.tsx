import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import { Object3D, Vector3, Quaternion } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface FollowCameraProps {
    target: Object3D | null
    frontDistance?: number // 初期スナップでの前方距離
    height?: number // 目線からの高さオフセット
    orbitRef: RefObject<OrbitControlsImpl | null>
    smoothFollow?: number // 通常追従のスムーズ係数(0..1) 例: 0.15
    selectDuration?: number // ターゲット選択時の移動イージング時間(秒)
}

export function FollowCamera({
    orbitRef,
    target,
    frontDistance = 3,
    height = 1,
    smoothFollow = 0.15,
    selectDuration = 0.5
}: FollowCameraProps) {
    const { camera, clock } = useThree()

    // 目線や姿勢の一時バッファ
    const tmpPos = useRef(new Vector3())
    const tmpQuat = useRef(new Quaternion())

    // 相対ベクトル（ターゲットのローカル座標系での camera - target）
    const relLocal = useRef(new Vector3()) // オービット・ズームで随時更新
    const haveRel = useRef(false)

    // 選択時トランジションの状態
    const transitioning = useRef(false)
    const tStart = useRef(0)
    const tEnd = useRef(0)
    const camFrom = useRef(new Vector3())
    const tgtFrom = useRef(new Vector3())
    const camTo = useRef(new Vector3())
    const tgtTo = useRef(new Vector3())

    // イージング（選択時）
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

    // 現在のターゲット目線位置
    const getEye = () => {
        target!.getWorldPosition(tmpPos.current)
        return tmpPos.current.clone().add(new Vector3(0, 0.5, 0))
    }

    // 現在のターゲット姿勢（ワールド）
    const getTargetQuat = () => {
        target!.getWorldQuaternion(tmpQuat.current)
        return tmpQuat.current.clone()
    }

    // 選択時：顔正面へスムーズ移動してオービット開始
    useEffect(() => {
        if (!target || !orbitRef.current) return

        const eye = getEye()
        const q = getTargetQuat()

        // ターゲットのローカル「前方」(0,0,1) をワールドへ
        const forward = new Vector3(0, 0, 1).applyQuaternion(q).normalize()
        const desiredCam = eye
            .clone()
            .addScaledVector(forward, frontDistance) // 顔の前
            .add(new Vector3(0, height - 0.5, 0)) // 目線基準の高さ

        // トランジション開始
        camFrom.current.copy(camera.position)
        tgtFrom.current.copy(orbitRef.current.target)
        camTo.current.copy(desiredCam)
        tgtTo.current.copy(eye)
        tStart.current = clock.getElapsedTime()
        tEnd.current = tStart.current + Math.max(0.01, selectDuration)
        transitioning.current = true

        // 「この配置」を基準とする relLocal を初期化
        const worldRel = desiredCam.clone().sub(eye) // ワールドの相対
        const qInv = q.clone().invert()
        relLocal.current.copy(worldRel.applyQuaternion(qInv)) // ローカルへ変換
        haveRel.current = true
    }, [target])

    useFrame(() => {
        const controls = orbitRef.current
        if (!target || !controls) return

        const now = clock.getElapsedTime()

        // ① 選択時トランジション中はイージングで補間
        if (transitioning.current) {
            const t = Math.min(1, (now - tStart.current) / (tEnd.current - tStart.current))
            const e = easeOutCubic(t)
            camera.position.lerpVectors(camFrom.current, camTo.current, e)
            controls.target.lerpVectors(tgtFrom.current, tgtTo.current, e)
            controls.update()

            // 進行中もユーザーが回転/ズームできるよう relLocal を常に更新しておく
            const eyeNow = tgtTo.current.clone() // 目標の目線（ほぼ固定）
            const qNow = getTargetQuat()
            const worldRel = camera.position.clone().sub(eyeNow)
            const qInv = qNow.clone().invert()
            relLocal.current.copy(worldRel.applyQuaternion(qInv))
            haveRel.current = true

            if (t >= 1) {
                transitioning.current = false
            }
            return
        }

        const eye = getEye()

        // 回転追従なし：平行移動Δだけを加算（前回答の方式）
        const delta = eye.clone().sub(controls.target)
        if (smoothFollow > 0) {
            controls.target.lerp(eye, smoothFollow)
            camera.position.lerp(camera.position.clone().add(delta), smoothFollow)
        } else {
            controls.target.copy(eye)
            camera.position.add(delta)
        }
        controls.update()
    })

    return null
}
