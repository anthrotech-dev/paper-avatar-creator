import { Suspense, useEffect, useRef, useState } from 'react'
import { Texture, Group, AnimationMixer, CanvasTexture, TextureLoader, MeshPhongMaterial, Mesh, SRGBColorSpace } from 'three';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

import Konva from 'konva';
import { Stage, Layer, Line, Rect } from 'react-konva';
import { TexturePreview } from './TexturePreview';
import { Box, Button, IconButton, Popover, Slider, Typography } from '@mui/material';

import { BsFillEraserFill } from "react-icons/bs";
import { BsBrushFill } from "react-icons/bs";
import { BsFillPaletteFill } from "react-icons/bs";
import { IoIosUndo } from "react-icons/io";
import { MdDelete } from "react-icons/md";

type TextureKind = 'Head-Front' | 'Head-Back' | 'Body-Front' | 'Body-Back' | 'Hand-Front' | 'Hand-Back' | 'Legs-Front' | 'Legs-Back' | 'Tail-Front' | 'Tail-Back';

const textureKeyMap: Record<string, TextureKind> = {
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

function useKonvaTexture(stageRef: React.RefObject<Konva.Stage | null>, event: any): CanvasTexture {

    const [tex] = useState(() => new CanvasTexture(document.createElement('canvas')));

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;

        const layer = stage.getLayers()[0];

        // scene 用キャンバスを直接参照
        const canvas: HTMLCanvasElement = layer.getNativeCanvasElement();
        tex.flipY = false;
        tex.image = canvas;
        tex.needsUpdate = true;
        tex.colorSpace = SRGBColorSpace;

        // Konva が何か描いたら GPU 転送を更新
        const update = () => {
            tex.needsUpdate = true
        };
        layer.on('draw', update);

        return () => {stage.off('draw', update)}
    }, [stageRef, tex, event]);

    return tex;
}

function Avatar({textures}: {textures: Record<string, Texture>}) {
    const group = useRef<Group>(null);
    const { nodes, scene, animations } = useGLTF('/RESO_Pera.glb');
    const mixer = useRef<AnimationMixer>(null);


    useEffect(() => {
        for (const key in nodes) {
            if (textureKeyMap[key] && nodes[key].type === 'Mesh') {
                const mesh = nodes[key] as Mesh;
                mesh.material = new MeshPhongMaterial({
                    color: '#FFFFFF',
                    map: textures[textureKeyMap[key]],
                    flatShading: true,
                    alphaTest: 0.5,
                });
                mesh.material.needsUpdate = true;
            }
        }
    }, [nodes, textures]);

    useEffect(() => {
        if (animations.length && group.current) {
            mixer.current = new AnimationMixer(group.current);
            animations.forEach((clip) => {
                mixer.current?.clipAction(clip)?.play();
            });
        }
        return () => {mixer.current?.stopAllAction()};
    }, [animations]);

    useFrame((_state, delta) => {
        mixer.current?.update(delta);
    });

    return <primitive 
        position={[-1, 0, 0]}
        scale={[0.01, 0.01, 0.01]}
    ref={group} object={scene} />;
}

interface stroke {
    tool: string;
    points: number[];
    color: string;
    width: number;
}

function App() {

    const stageRef = useRef<Konva.Stage>(null);

    const [tool, setTool] = useState('brush');
    const [strokes, setStrokes] = useState<stroke[]>([]);
    const isDrawing = useRef(false);

    const [color, setColor] = useState('#2e7eff');
    const [width, setWidth] = useState(5);
    const [widthAnchor, setWidthAnchor] = useState<HTMLButtonElement | null>(null);

    const [textures, setTextures] = useState<Record<string, Texture>>({});
    const [editing, setEditing] = useState<TextureKind | null>(null);

    const editingTex = useKonvaTexture(stageRef, editing);

    const [oldTexture, setOldTexture] = useState<Texture | null>(null);

    const colorInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        (async () => {
            const loader = new TextureLoader();
            const textures: Record<TextureKind, Texture> = {
                "Head-Front": await loader.loadAsync('/tex/Head-Front.png'),
                "Head-Back":  await loader.loadAsync('/tex/Head-Back.png'),
                "Body-Front": await loader.loadAsync('/tex/Body-Front.png'),
                "Body-Back":  await loader.loadAsync('/tex/Body-Back.png'),
                "Hand-Front": await loader.loadAsync('/tex/Hand-Front.png'),
                "Hand-Back":  await loader.loadAsync('/tex/Hand-Back.png'),
                "Legs-Front": await loader.loadAsync('/tex/Legs-Front.png'),
                "Legs-Back":  await loader.loadAsync('/tex/Legs-Back.png'),
                "Tail-Front": await loader.loadAsync('/tex/Tail-Front.png'),
                "Tail-Back":  await loader.loadAsync('/tex/Tail-Back.png'),
            }

            for (const key in textures) {
                textures[key as TextureKind].flipY = false;
            }

            setTextures(textures);
        })()
    }, []);

    useEffect(() => {
        if (!editing) return;
        if (textures[editing]) {
            setOldTexture(textures[editing].clone());
        }
        setTextures((prev) => ({
            ...prev,
            [editing]: editingTex,
        }))
    }, [editing]);

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        isDrawing.current = true;
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        setStrokes([...strokes, { tool, points: [pos.x, pos.y], color, width }]);
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        // no drawing - skipping
        if (!isDrawing.current) {
        return;
        }
        const stage = e.target.getStage();
        const point = stage?.getPointerPosition();
        if (!point) return;
        
        // To draw line
        let lastLine = strokes[strokes.length - 1];
        // add point
        lastLine.points = lastLine.points.concat([point.x, point.y]);

        // replace last
        strokes.splice(strokes.length - 1, 1, lastLine);
        setStrokes(strokes.concat());
    };

    const handleMouseUp = () => {
        isDrawing.current = false;
    };

    return <div
        style={{
            width: '100vw',
            height: '100dvh',
            position: 'relative',
        }}
    >

        <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        console.log('Image loaded:', img);
                        const newTexture = new Texture(img);
                        newTexture.flipY = false;
                        setOldTexture(newTexture);
                    };
                    img.src = event.target?.result as string;
                };
                reader.readAsDataURL(file);
            }}
        />

        <Canvas 
            style={{
                width: '100vw',
                height: '100dvh',
                position: 'absolute',
                top: 0,
                left: 0,
            }}
            camera={{ position: [0, 1, 3], fov: 50 }}
        >
            <ambientLight intensity={1} />
            <directionalLight position={[2, 2, 2]} intensity={1} />
            <Suspense fallback={null}>
                <Avatar
                    textures={textures}
                />
            </Suspense>
            <OrbitControls />
        </Canvas>

        <div
            style={{
                width: '40vw',
                height: 'calc(100dvh - 20px)',
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '10px',
                zIndex: 1,
                color: 'white',
                padding: '10px',
                overflowX: 'hidden',
                overflowY: 'auto',
                alignItems: 'stretch',
            }}
        >

            { editing ? <>

            <h2>Edit Texture: {editing}</h2>

            <Box
                display="flex"
                alignItems="center"
                marginBottom="10px"
            >
                <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="flex-end"
                    height="400px"
                    gap={1}
                >
                    <IconButton
                        size="large"
                        sx={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: tool === 'brush' ? 'primary.main' : 'text.disabled',
                        }}
                        onClick={() => setTool('brush')}
                    >
                        <BsBrushFill
                            color="white"
                        />
                    </IconButton>
                    <IconButton
                        size="large"
                        sx={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: tool === 'eraser' ? 'primary.main' : 'text.disabled',
                        }}
                        onClick={() => setTool('eraser')}
                    >
                        <BsFillEraserFill
                            color="white"
                        />
                    </IconButton>

                    <IconButton
                        size="large"
                        sx={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: color
                        }}
                        onClick={() => {
                            if (colorInputRef.current) {
                                colorInputRef.current.click();
                            }
                        }}
                    >
                        <BsFillPaletteFill
                            color="white"
                        />
                        <input
                            type="color"
                            ref={colorInputRef}
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            style={{
                                visibility: 'hidden',
                                width: '0',
                                height: '0',
                            }}
                        />
                    </IconButton>

                    <IconButton
                        size="large"
                        sx={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: 'primary.main',
                        }}
                        onClick={(e) => setWidthAnchor(e.currentTarget)}
                    >
                        <Typography
                            variant="body1"
                            sx={{ color: 'white' }}
                        >
                            {width}
                        </Typography>
                    </IconButton>

                    <Popover
                        open={Boolean(widthAnchor)}
                        anchorEl={widthAnchor}
                        onClose={() => setWidthAnchor(null)}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'center',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'center',
                        }}
                        slotProps={{
                            paper: {
                                sx: {
                                    padding: '10px',
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    color: 'white',
                                    borderRadius: '10px',
                                },
                            },
                        }}

                    >
                        <Slider
                            value={width}
                            min={1}
                            max={50}
                            onChange={(_e, newValue) => setWidth(newValue as number)}
                            sx={{ width: '200px', padding: '20px' }}
                            onChangeCommitted={() => setWidthAnchor(null)}
                        />
                    </Popover>

                    <IconButton
                        size="large"
                        onClick={() => {
                            if (strokes.length === 0) return;
                            setStrokes(strokes.slice(0, -1));
                        }}
                        sx={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: 'primary.main',
                        }}
                    >
                        <IoIosUndo
                            color="white"
                        />
                    </IconButton>


                    <IconButton
                        size="large"
                        onClick={() => {
                            setStrokes([]);
                            setOldTexture(null);
                        }}
                        sx={{
                            backgroundColor: 'error.main',
                        }}
                    >
                        <MdDelete
                            color="white"
                        />
                    </IconButton>

                </Box>

                <Stage
                    ref={stageRef}
                    width={400}
                    height={400}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                >
                    <Layer>
                        {oldTexture && (
                            <Rect
                                x={0}
                                y={0}
                                width={400}
                                height={400}
                                fillPatternImage={oldTexture.image as HTMLImageElement}
                                fillPatternRepeat="no-repeat"
                                fillPatternScaleX={400 / oldTexture.image.width}
                                fillPatternScaleY={400 / oldTexture.image.height}
                                fillPatternOffsetX={0}
                                fillPatternOffsetY={0}
                            />
                        )}

                        {strokes.map((line, i) => (
                            <Line
                                key={i}
                                points={line.points}
                                stroke={line.color}
                                strokeWidth={line.width}
                                tension={0.5}
                                lineCap="round"
                                lineJoin="round"
                                globalCompositeOperation={
                                    line.tool === 'eraser' ? 'destination-out' : 'source-over'
                                }
                            />
                        ))}
                    </Layer>
                </Stage>
            </Box>

            <Box
                display="flex"
                gap="10px"
            >
                <Button
                    variant="contained"
                    onClick={() => {
                        if (fileInputRef.current) {
                            fileInputRef.current.click();
                        }
                    }}
                >
                    Load
                </Button>

                <Button
                    variant="contained"
                    onClick={() => {
                        if (!editing) return
                        const canvas = editingTex.image as HTMLCanvasElement;
                        const tmp = document.createElement('canvas');
                        tmp.width = canvas.width;
                        tmp.height = canvas.height;
                        const ctx = tmp.getContext('2d');
                        if (!ctx) return;
                        ctx.drawImage(canvas, 0, 0);

                        const editedTexture = new CanvasTexture(tmp);
                        editedTexture.flipY = false;

                        setTextures((prev) => ({
                            ...prev,
                            [editing]: editedTexture,
                        }));

                        setStrokes([]);
                        setEditing(null)
                    }}
                >
                    Done
                </Button>
            </Box>

            </> : <>
                <h2>Avatar Editor</h2>
                <h3>Head</h3>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '10px',
                    }}
                >
                    <div>
                        <h4>Front</h4>
                        <TexturePreview 
                            texture={textures['Head-Front']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Head-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Head-Back']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Head-Back')}
                        />
                    </div>
                </div>
                <h3>Body</h3>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '10px',
                    }}
                >
                    <div>
                        <h4>Front</h4>
                        <TexturePreview 
                            texture={textures['Body-Front']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Body-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Body-Back']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Body-Back')}
                        />
                    </div>
                </div>
                <h3>Hands</h3>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '10px',
                    }}
                >
                    <div>
                        <h4>Front</h4>
                        <TexturePreview 
                            texture={textures['Hand-Front']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Hand-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Hand-Back']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Hand-Back')}
                        />
                    </div>
                </div>
                <h3>Legs</h3>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '10px',
                    }}
                >
                    <div>
                        <h4>Front</h4>
                        <TexturePreview 
                            texture={textures['Legs-Front']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Legs-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Legs-Back']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Legs-Back')}
                        />
                    </div>
                </div>
                <h3>Tail</h3>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '10px',
                    }}
                >
                    <div>
                        <h4>Front</h4>
                        <TexturePreview 
                            texture={textures['Tail-Front']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Tail-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Tail-Back']}
                            style={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Tail-Back')}
                        />
                    </div>
                </div>
            </>}
        </div>
    </div>
}

export default App
