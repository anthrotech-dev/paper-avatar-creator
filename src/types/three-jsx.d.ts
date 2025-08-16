import { Texture } from 'three'
import { ThreeElement } from '@react-three/fiber'

// Define the uniform types for our custom materials
interface SkyboxUniforms {
    topColor: [number, number, number]
    middleColor: [number, number, number]
    bottomColor: [number, number, number]
    offset: number
    exponent: number
}

interface FadingFloorMaterialUniforms {
    map: Texture | null
    fadeRadius: number
}

// Define the material types
type SkyboxMaterial = THREE.ShaderMaterial & SkyboxUniforms
type FadingFloorMaterialType = THREE.ShaderMaterial & FadingFloorMaterialUniforms

declare global {
    namespace JSX {
        interface IntrinsicElements {
            skybox: ThreeElement<typeof THREE.ShaderMaterial> & {
                // Override with our specific props
                topColor?: [number, number, number]
                middleColor?: [number, number, number]
                bottomColor?: [number, number, number]
                offset?: number
                exponent?: number
                side?: number
            }
            fadingFloorMaterial: ThreeElement<typeof THREE.ShaderMaterial> & {
                // Override with our specific props
                map?: Texture | null
                fadeRadius?: number
            }
        }
    }
}

// Also extend the react/jsx-runtime module for consistency
declare module 'react/jsx-runtime' {
    namespace JSX {
        interface IntrinsicElements {
            skybox: ThreeElement<typeof THREE.ShaderMaterial> & {
                topColor?: [number, number, number]
                middleColor?: [number, number, number]
                bottomColor?: [number, number, number]
                offset?: number
                exponent?: number
                side?: number
            }
            fadingFloorMaterial: ThreeElement<typeof THREE.ShaderMaterial> & {
                map?: Texture | null
                fadeRadius?: number
            }
        }
    }
}

declare module 'react/jsx-dev-runtime' {
    namespace JSX {
        interface IntrinsicElements {
            skybox: ThreeElement<typeof THREE.ShaderMaterial> & {
                topColor?: [number, number, number]
                middleColor?: [number, number, number]
                bottomColor?: [number, number, number]
                offset?: number
                exponent?: number
                side?: number
            }
            fadingFloorMaterial: ThreeElement<typeof THREE.ShaderMaterial> & {
                map?: Texture | null
                fadeRadius?: number
            }
        }
    }
}

export {}
