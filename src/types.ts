export type TextureKind =
    | 'Head-Front'
    | 'Head-Back'
    | 'Eyes-Closed'
    | 'Mouth-Open'
    | 'Body-Front'
    | 'Body-Back'
    | 'Hand-Front'
    | 'Hand-Back'
    | 'Legs-Front'
    | 'Legs-Back'
    | 'Tail-Front'
    | 'Tail-Back'

export const textureKeyMap: Record<string, TextureKind> = {
    Head_Front: 'Head-Front',
    Head_Back: 'Head-Back',
    Body_Front: 'Body-Front',
    Body_Back: 'Body-Back',
    LeftHand_Front: 'Hand-Front',
    LeftHand_Back: 'Hand-Back',
    RightHand_Front: 'Hand-Front',
    RightHand_Back: 'Hand-Back',
    LeftFoot_Front: 'Legs-Front',
    LeftFoot_Back: 'Legs-Back',
    RightFoot_Front: 'Legs-Front',
    RightFoot_Back: 'Legs-Back',
    Tail_Front: 'Tail-Front',
    Tail_Back: 'Tail-Back'
}

export const texturePositions: Record<string, number[]> = {
    'Head-Front': [375, 54],
    'Head-Back': [1399, 54],
    'Eyes-Closed': [717, 54],
    'Mouth-Open': [33, 54],
    'Body-Front': [375, 396],
    'Body-Back': [1399, 396],
    'Right-Hand-Front': [33, 396],
    'Right-Hand-Back': [1740, 396],
    'Left-Hand-Front': [717, 396],
    'Left-Hand-Back': [1058, 396],
    'Left-Legs-Front': [717, 738],
    'Left-Legs-Back': [1058, 738],
    'Right-Legs-Front': [33, 738],
    'Right-Legs-Back': [1740, 738],
    'Tail-Front': [375, 738],
    'Tail-Back': [1399, 738]
}

export const symetricTextures: string[] = [
    'Hand-Front',
    'Hand-Back',
    'Legs-Front',
    'Legs-Back',
    'Tail-Front',
    'Tail-Back'
]

export type AvatarParams = {
    headSize: number
    neckLength: number
    headInFront: boolean
    handSize: number
    bodySize: number
    tailSize: number
    tailPosition: number
    tailRotation: number
    disableTail: boolean
    legsSize: number
    legsDistance: number
    legsDistanceFromBody: number
    legsInFront: boolean
}

export type AvatarManifest = {
    id: string
    creatorID: string
    extends?: string
    params: AvatarParams
    textureURL: string

    name: string
    creator: string
    description?: string
    editable: boolean
    exportable: boolean
}
