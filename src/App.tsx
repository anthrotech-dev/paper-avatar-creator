import { Suspense, useEffect, useRef, useState } from 'react'
import { Texture, Group, AnimationMixer, CanvasTexture, TextureLoader, MeshPhongMaterial, Mesh, SRGBColorSpace } from 'three';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

import Konva from 'konva';
import { Stage, Layer, Line, Rect, Circle } from 'react-konva';
import { TexturePreview } from './TexturePreview';
import { Box, Button, IconButton, MenuItem, Popover, Slider, Typography, Menu } from '@mui/material';

import { BsFillEraserFill } from "react-icons/bs";
import { BsBrushFill } from "react-icons/bs";
import { BsFillPaletteFill } from "react-icons/bs";
import { IoIosUndo } from "react-icons/io";
import { MdDelete } from "react-icons/md";

import JSZip from 'jszip';
import { Compress, sha256SumBlob, sha256SumBuffer, textureToPng, useKonvaTexture } from './util';

type TextureKind = 'Head-Front' | 'Head-Back' | 'Eyes-Closed' | 'Mouth-Open' | 'Body-Front' | 'Body-Back' | 'Hand-Front' | 'Hand-Back' | 'Legs-Front' | 'Legs-Back' | 'Tail-Front' | 'Tail-Back';

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

function Avatar({textures, editing}: {textures: Record<string, Texture>, editing: TextureKind | null}) {
    const group = useRef<Group>(null);
    const { nodes, scene, animations } = useGLTF('/anim@RESO_Pera_idle.glb');
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
                console.log(`Set texture for ${key} to ${textureKeyMap[key]}`);
            } else {
                console.warn(`No texture for ${key}`);
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

    useEffect(() => {
        switch (editing) {
            case 'Head-Front':
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Head-Front'];
                break;
            case 'Eyes-Closed':
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Eyes-Closed'];
                break;
            case 'Mouth-Open':
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Mouth-Open'];
                break;
        }
    }, [editing]);

    let facial: 'Head-Front' | 'Eyes-Closed' | 'Mouth-Open' = 'Head-Front';
    const chanceToCloseEyes = 0.004;
    const chanceToOpenMouth = 0.002;
    const chanceToReturnToNormal = 0.05;
    useFrame((_state, delta) => {
        mixer.current?.update(delta);
        if (editing) return
        if (facial === 'Head-Front') {
            if (Math.random() < chanceToCloseEyes) {
                facial = 'Eyes-Closed';
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Eyes-Closed'];
            } else if (Math.random() < chanceToOpenMouth) {
                facial = 'Mouth-Open';
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Mouth-Open'];
            }
        } else if (facial === 'Eyes-Closed') {
            if (Math.random() < chanceToReturnToNormal) {
                facial = 'Head-Front';
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Head-Front'];
            }
        } else if (facial === 'Mouth-Open') {
            if (Math.random() < chanceToReturnToNormal) {
                facial = 'Head-Front';
                // @ts-ignore
                nodes['Head_Front'].material.map = textures['Head-Front'];
            }
        }
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
    const drawingLayerRef = useRef<Konva.Layer>(null);
    const previewLayerRef = useRef<Konva.Layer>(null);
    const circleRef = useRef<Konva.Circle>(null);

    const [tool, setTool] = useState('brush');
    const [strokes, setStrokes] = useState<stroke[]>([]);
    const isDrawing = useRef(false);

    const [color, setColor] = useState('#2e7eff');
    const [width, setWidth] = useState(20);
    const [widthAnchor, setWidthAnchor] = useState<HTMLButtonElement | null>(null);
    const [traceAnchor, setTraceAnchor] = useState<HTMLDivElement | null>(null);

    const [textures, setTextures] = useState<Record<string, Texture>>({});
    const [editing, setEditing] = useState<TextureKind | null>(null);

    const editingTex = useKonvaTexture(drawingLayerRef, editing);

    const [oldTexture, setOldTexture] = useState<Texture | null>(null);

    const [traceTexture, setTraceTexture] = useState<Texture | undefined>(undefined);

    const colorInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUndo = () => {
        if (strokes.length === 0) return;
        setStrokes(strokes.slice(0, -1));
    }

    // register keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleUndo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleUndo])

    useEffect(() => {
        (async () => {
            const loader = new TextureLoader();
            const textures: Record<TextureKind, Texture> = {
                "Head-Front": await loader.loadAsync('/tex/Head-Front.png'),
                "Head-Back":  await loader.loadAsync('/tex/Head-Back.png'),
                "Eyes-Closed": await loader.loadAsync('/tex/Eyes-Closed.png'),
                "Mouth-Open":  await loader.loadAsync('/tex/Mouth-Open.png'),
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
                textures[key as TextureKind].colorSpace = SRGBColorSpace;
            }

            setTextures(textures);
        })()
    }, []);

    useEffect(() => {
        setTraceTexture(undefined);
        if (!editing) return;
        if (textures[editing]) {
            setOldTexture(textures[editing].clone());
        }
        setTextures((prev) => ({
            ...prev,
            [editing]: editingTex,
        }))
    }, [editing]);

    const handleExport = async () => {
        const zip = new JSZip();
        for (const key in textures) {
            const texture = textures[key];
            if (!texture) continue;

            const { blob } = await textureToPng(texture)
            zip.file(`${key}.png`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'avatar-textures.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    const handleResoniteExport = async () => {

        const assets: Array<any> = []

        const zip = new JSZip();

        for (const key in textures) {
            const texture = textures[key];
            if (!texture) continue;

            const { blob } = await textureToPng(texture);
            const hash = await sha256SumBlob(blob);

            zip.file(`Assets/${hash}`, blob);
            assets.push({
                "part": key,
                "hash": hash,
                "bytes": blob.size,
            })
        }

        let slots = await fetch('/package/slots.json').then(res => res.text());
        for (const elem of assets) {
            slots = slots.replace(`[::${elem.part}::]`, elem.hash);
        }
        const slotsBin = await Compress(slots)
        const slotsHash = await sha256SumBuffer(slotsBin);

        zip.file(`Assets/${slotsHash}`, slotsBin);

        const catalog = {
            "id": "R-Main",
            "ownerId": "4cyqxejyao5zsogdkyq3oxz4b69yqph1shibhng76u1acyibhksy",
            "assetUri": "packdb:///" + slotsHash,
            "version": {
                "globalVersion": 0,
                "localVersion": 0,
                "lastModifyingUserId": null,
                "lastModifyingMachineId": null
            },
            "name": "Avatar",
            "description": null,
            "recordType": "object",
            "ownerName": null,
            "tags": null,
            "path": null,
            "thumbnailUri": null,
            "lastModificationTime": "2025-07-23T06:29:57.8443856Z",
            "creationTime": "2025-07-23T06:29:57.8443856Z",
            "firstPublishTime": null,
            "isDeleted": false,
            "isPublic": false,
            "isForPatrons": false,
            "isListed": false,
            "isReadOnly": false,
            "visits": 0,
            "rating": 0,
            "randomOrder": 0,
            "submissions": null,
            "assetManifest": [
                {
                    "hash": "41ccec83c150c98d061ad6245e0aa866b08ba2237f0087f6e21a0d3deb2cec19",
                    "bytes": 117
                },
                {
                    "hash": "aedca4d3da09eaaa3ef2621025e3fd713019395ec4f0c0ea1d09af5146e8f787",
                    "bytes": 126710
                },
                ...(assets.map((asset) => ({
                    "hash": asset.hash,
                    "bytes": asset.bytes
                })))
            ],
            "migrationMetadata": null
        }

        const catalogStr = JSON.stringify(catalog);
        zip.file('R-Main.record', catalogStr);

        await fetch('/package/41ccec83c150c98d061ad6245e0aa866b08ba2237f0087f6e21a0d3deb2cec19').then(res => res.blob())
        .then(blob => zip.file('Assets/41ccec83c150c98d061ad6245e0aa866b08ba2237f0087f6e21a0d3deb2cec19', blob));

        await fetch('/package/aedca4d3da09eaaa3ef2621025e3fd713019395ec4f0c0ea1d09af5146e8f787').then(res => res.blob())
        .then(blob => zip.file('Assets/aedca4d3da09eaaa3ef2621025e3fd713019395ec4f0c0ea1d09af5146e8f787', blob));

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'avatar.resonitepackage';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

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

    const setTemplateToTrace = (name: string) => {
        const loader = new TextureLoader();
        loader.load(`/tex/${name}.png`, (texture) => {
            texture.flipY = false;
            texture.colorSpace = SRGBColorSpace;
            setTraceTexture(texture);
        });

    }

    const setEditingToTrace = (name: string) => {
        const canvas = textures[name]?.image as HTMLCanvasElement;
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width;
        tmp.height = canvas.height;
        const ctx = tmp.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(canvas, 0, 0);
        const editedTexture = new CanvasTexture(tmp);
        editedTexture.flipY = false;
        editedTexture.colorSpace = SRGBColorSpace;
        setTraceTexture(editedTexture);

    }

    useEffect(() => {
        const circle = circleRef.current;
        if (!circle) return;
        circle.radius(width / 2);
        circle.getLayer()?.batchDraw();
    }, [width]);

    useEffect(() => {
        const stage = stageRef.current;
        const previewLayer = previewLayerRef.current;
        const circle = circleRef.current;

        if (!stage || !previewLayer || !circle) return;

        // レイヤーはヒットテスト不要＆クリックイベントを受けない
        previewLayer.listening(false);
        previewLayer.hitGraphEnabled(false);

        const updateCircle = () => {
            const p = stage.getPointerPosition();
            if (!p) {
                // ステージ外なら隠す
                circle.visible(false);
                previewLayer.batchDraw();
                return;
            }
            // ステージがズーム・ドラッグしている場合も正しく表示
            // getRelativePointerPosition(layer) を使うと簡単
            const pos = stage.getRelativePointerPosition();
                circle.position(pos);
                circle.visible(true);
                previewLayer.batchDraw();
        };

        // 描画負荷を減らすため requestAnimationFrame を挟む
        let raf = 0;
        const handleMove = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(updateCircle);
        };

        stage.on('mousemove touchmove', handleMove);
        stage.on('mouseout', () => {
            circle.visible(false);
            previewLayer.batchDraw();
        });

        return () => {
            stage.off('mousemove touchmove', handleMove);
            stage.off('mouseout');
            if (raf) cancelAnimationFrame(raf);
        };
    }, [editing]);


    const handleMouseUp = () => {
        isDrawing.current = false;
    };

    return <Box
        sx={{
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
            multiple={!editing}
            onChange={(e) => {
                if (editing) {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const url = URL.createObjectURL(file);
                    const loader = new TextureLoader();

                    loader.load(url, (texture) => {
                        texture.flipY = false;
                        texture.colorSpace = SRGBColorSpace;
                        setOldTexture(texture);
                    });
                } else {
                    for (const file of e.target.files || []) {
                        const url = URL.createObjectURL(file);
                        const name = file.name.split('.')[0];

                        if (!(name in textures)) {
                            continue
                        }

                        const loader = new TextureLoader();
                        loader.load(url, (texture) => {
                            texture.flipY = false;
                            texture.colorSpace = SRGBColorSpace;
                            setTextures((prev) => ({
                                ...prev,
                                [name]: texture,
                            }));
                        });
                    }
                }
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
                    editing={editing}
                    textures={textures}
                />
            </Suspense>
            <OrbitControls />
        </Canvas>

        <Box
            sx={{
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
                display: 'flex',
                flexDirection: 'column',
                gap: 1
            }}
        >

            { editing ? <>

            <h2>Edit Texture: {editing}</h2>

            <Box
                display="flex"
                alignItems="center"
                gap={1}
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
                        onClick={handleUndo}
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
                    style={{ cursor: 'none', border: '1px solid #ccc' }}
                >
                    {traceTexture &&
                    <Layer>
                        <Rect
                            x={0}
                            y={0}
                            width={400}
                            height={400}
                            fillPatternImage={traceTexture.image as HTMLImageElement}
                            fillPatternRepeat="no-repeat"
                            fillPatternScaleX={400 / traceTexture.image.width}
                            fillPatternScaleY={400 / traceTexture.image.height}
                            fillPatternOffsetX={0}
                            fillPatternOffsetY={0}
                            opacity={0.3}
                        />
                    </Layer>
                    }
                    <Layer
                        ref={drawingLayerRef}
                    >
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
                    <Layer ref={previewLayerRef}>
                        <Circle
                            ref={circleRef}
                            radius={width / 2}
                            dash={[2, 2]}
                            strokeWidth={1}
                            visible={false}
                            stroke="gray"
                        />
                    </Layer>
                </Stage>

                <Box
                    display="flex"
                    flexDirection="column"
                    height="400px"
                    justifyContent="flex-end"
                >
                    <TexturePreview
                        texture={traceTexture}
                        sx={{
                            width: '80px',
                            height: '80px',
                            cursor: 'pointer',
                            border: '1px dashed white',
                            borderRadius: '5px',
                        }}
                        onClick={(e) => {
                            setTraceAnchor(e.currentTarget);
                        }}
                    />

                    <Menu
                        anchorEl={traceAnchor}
                        open={Boolean(traceAnchor)}
                        onClose={() => setTraceAnchor(null)}
                        style={{ color: 'white' }}
                        slotProps={{
                            paper: {
                                style: {
                                    maxHeight: '400px',
                                }
                            }
                        }}
                    >
                        <MenuItem onClick={() => setTraceTexture(undefined)}>None</MenuItem>

                        <MenuItem onClick={() => setEditingToTrace('Head-Front')}>Head Front</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Head-Back')}>Head Back</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Eyes-Closed')}>Eyes Closed</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Mouth-Open')}>Mouth Open</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Body-Front')}>Body Front</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Body-Back')}>Body Back</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Hand-Front')}>Hand Front</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Hand-Back')}>Hand Back</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Legs-Front')}>Legs Front</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Legs-Back')}>Legs Back</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Tail-Front')}>Tail Front</MenuItem>
                        <MenuItem onClick={() => setEditingToTrace('Tail-Back')}>Tail Back</MenuItem>

                        <MenuItem onClick={() => setTemplateToTrace('Head-Front')}>Head Front (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Head-Back')}>Head Back (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Eyes-Closed')}>Eyes Closed (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Mouth-Open')}>Mouth Open (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Body-Front')}>Body Front (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Body-Back')}>Body Back (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Hand-Front')}>Hand Front (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Hand-Back')}>Hand Back (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Legs-Front')}>Legs Front (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Legs-Back')}>Legs Back (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Tail-Front')}>Tail Front (Template)</MenuItem>
                        <MenuItem onClick={() => setTemplateToTrace('Tail-Back')}>Tail Back (Template)</MenuItem>
                    </Menu>
                </Box>

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
                        editedTexture.colorSpace = SRGBColorSpace;

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
                            sx={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Head-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Head-Back']}
                            sx={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Head-Back')}
                        />
                    </div>
                    <div>
                        <h4>Eyes Closed</h4>
                        <TexturePreview 
                            texture={textures['Eyes-Closed']}
                            sx={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Eyes-Closed')}
                        />
                    </div>
                    <div>
                        <h4>Mouth Open</h4>
                        <TexturePreview 
                            texture={textures['Mouth-Open']}
                            sx={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Mouth-Open')}
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
                            sx={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Body-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Body-Back']}
                            sx={{ width: '100px', height: '100px'}}
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
                            sx={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Hand-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Hand-Back']}
                            sx={{ width: '100px', height: '100px'}}
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
                            sx={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Legs-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Legs-Back']}
                            sx={{ width: '100px', height: '100px'}}
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
                            sx={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Tail-Front')}
                        />
                    </div>
                    <div>
                        <h4>Back</h4>
                        <TexturePreview 
                            texture={textures['Tail-Back']}
                            sx={{ width: '100px', height: '100px'}}
                            onClick={() => setEditing('Tail-Back')}
                        />
                    </div>
                </div>
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
                        Load Images
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            handleExport();
                        }}
                    >
                        Export
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            handleResoniteExport();
                        }}
                    >
                        Export Resonite
                    </Button>
                </Box>
            </>}
        </Box>
    </Box>
}

export default App
