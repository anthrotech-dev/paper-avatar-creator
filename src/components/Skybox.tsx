import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

const SkyboxMaterial = shaderMaterial(
    {
        topColor: [207.0 / 255, 210.0 / 255, 230.0 / 255],
        middleColor: [1.0, 1.0, 1.0],
        bottomColor: [1.0, 1.0, 1.0],
        offset: 0,
        exponent: 0.3
    },
    // vertex shader
    `
    varying vec3 vWorldPos;
    void main(){
      vec4 wp = modelMatrix * vec4(position,1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
    // fragment shader
    `
    uniform vec3 topColor;
    uniform vec3 middleColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPos;
    void main(){
        float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
        float t = pow(clamp(h, 0.0, 1.0), exponent);

        vec3 col;
        if (t < 0.5) {
            float f = t / 0.5;
            col = mix(bottomColor, middleColor, f);
        } else {
            float f = (t - 0.5) / 0.5;
            col = mix(middleColor, topColor, f);
        }

        gl_FragColor = vec4(col, 1.0);
    }
  `
)

extend({ SkyboxMaterial })

export const Skybox = () => {
    return (
        <mesh>
            <sphereGeometry args={[100, 32, 32]} />
            {/* @ts-ignore */}
            <skyboxMaterial side={2} />
        </mesh>
    )
}
