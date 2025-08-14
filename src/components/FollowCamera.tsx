import { useFrame, useThree } from '@react-three/fiber'
import { Object3D, Vector3, Quaternion } from 'three'

interface FollowCameraProps {
    target: Object3D | null
    frontDistance?: number
    height?: number
    smooth?: number
}

export function FollowCamera({ target, frontDistance = 3, height = 2.5 }: FollowCameraProps) {
    const { camera } = useThree()

    useFrame(() => {
        if (!target) return
        const position = new Vector3()
        const quaternion = new Quaternion()
        target.getWorldPosition(position)
        target.getWorldQuaternion(quaternion)

        const forward = new Vector3()
        forward.set(0, 0, 1).applyQuaternion(quaternion).normalize()

        const cameraPos = position
            .clone()
            .addScaledVector(forward, frontDistance)
            .addScaledVector(new Vector3(0, 1, 0), height)

        const cameraLookAt = position.clone().add(new Vector3(0, 0.5, 0)) // Look at slightly above the target

        camera.position.set(...cameraPos.toArray())
        camera.lookAt(cameraLookAt)
    })

    return null
}
