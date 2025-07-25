


export type TextureKind = 'Head-Front' | 'Head-Back' | 'Eyes-Closed' | 'Mouth-Open' | 'Body-Front' | 'Body-Back' | 'Hand-Front' | 'Hand-Back' | 'Legs-Front' | 'Legs-Back' | 'Tail-Front' | 'Tail-Back';

export const textureKeyMap: Record<string, TextureKind> = {
    "Head_Front": "Head-Front",
    "Head_Back": "Head-Back",
    "Body_Front": "Body-Front",
    "Body_Back": "Body-Back",
    "LeftHand_Front": "Hand-Front",
    "LeftHand_Back": "Hand-Back",
    "RightHand_Front": "Hand-Front",
    "RightHand_Back": "Hand-Back",
    "LeftFoot_Front": "Legs-Front",
    "LeftFoot_Back": "Legs-Back",
    "RightFoot_Front": "Legs-Front",
    "RightFoot_Back": "Legs-Back",
    "Tail_Front": "Tail-Front",
    "Tail_Back": "Tail-Back",
}
