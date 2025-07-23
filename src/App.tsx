import { Suspense, useEffect, useRef, useState } from 'react'
import './App.css'
import { Texture, Group, AnimationMixer, CanvasTexture, TextureLoader, MeshPhongMaterial, Mesh, SRGBColorSpace } from 'three';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

import Konva from 'konva';
import { Stage, Layer, Line, Rect } from 'react-konva';
import { TexturePreview } from './TexturePreview';

type TextureKind = 'Head-Front' | 'Head-Back' | 'Body-Front' | 'Body-Back' | 'Hand-Front' | 'Hand-Back' | 'Legs-Front' | 'Legs-Back' | 'Tail-Front' | 'Tail-Back';

const textureKeyMap: Record<string, TextureKind> = {
    "Head-Front": "Head-Front",
    "Head-Back": "Head-Back",
    "Body-Front": "Body-Front",
    "Body-Back": "Body-Back",
    "LeftHand-Front": "Hand-Front",
    "LeftHand-Back": "Hand-Back",
    "RightHand-Front": "Hand-Front",
    "RightHand-Back": "Hand-Back",
    "LeftFoot-Front": "Legs-Front",
    "LeftFoot-Back": "Legs-Back",
    "RightFoot-Front": "Legs-Front",
    "RightFoot-Back": "Legs-Back",
    "Tail-Front": "Tail-Front",
    "Tail-Back": "Tail-Back",
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
    const { nodes, scene, animations } = useGLTF('/avatar.glb');
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
        position={[1, 0, 0]}
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

    const [color, setColor] = useState('#FFFFFF');
    const [width, setWidth] = useState(5);

    const [textures, setTextures] = useState<Record<string, Texture>>({});
    const [editing, setEditing] = useState<TextureKind | null>(null);

    const editingTex = useKonvaTexture(stageRef, editing);

    const [oldTexture, setOldTexture] = useState<Texture | null>(null);

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
            }}
        >

            { editing ? <>

            <h2>Edit Texture: {editing}</h2>

            <select
                value={tool}
                onChange={(e) => {
                setTool(e.target.value);
                }}
            >
                <option value="brush">Brush</option>
                <option value="eraser">Eraser</option>
            </select>

            <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ marginLeft: '10px' }}
            />

            <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                style={{ marginLeft: '10px', width: '60px' }}
            />

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

            <button
                onClick={() => {
                    setStrokes([])
                    setOldTexture(null)
                }}
            >
                全消し
            </button>

            <button
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
            </button>

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
