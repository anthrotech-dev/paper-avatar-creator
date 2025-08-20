import { useEffect, useState, type ReactNode } from 'react'
import { Box, Link, Typography } from '@mui/material'
import cfm from '@concrnt/cfm'
import { keyframes } from '@emotion/react'

const marquee = keyframes`
    0% {
        transform: translateX(0);
    }
    50% {
        transform: translateX(100%);
    }
    100% {
        transform: translateX(0);
    }
`

const flipMarquee = keyframes`
    0% {
        transform: translateX(0);
    }
    50% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(0);
    }
`

export interface CfmRendererProps {
    message: string
}

export interface RenderAstProps {
    ast: any
}

const Spoiler = ({ children }: { children: ReactNode }) => {
    const [open, setOpen] = useState(false)

    return (
        <Box
            component="span"
            sx={{
                cursor: 'pointer',
                color: open ? 'text.disabled' : 'transparent',
                backgroundColor: open ? 'transparent' : 'text.primary'
            }}
            onClick={(e) => {
                setOpen(!open)
                e.stopPropagation()
            }}
        >
            {children}
        </Box>
    )
}

const RenderAst = ({ ast }: RenderAstProps): ReactNode => {
    if (Array.isArray(ast)) {
        return (
            <>
                {ast.map((node: any, i: number) => (
                    <RenderAst key={i} ast={node} />
                ))}
            </>
        )
    }

    if (!ast) return <>null</>
    switch (ast.type) {
        case 'newline':
            return <br />
        case 'Line':
            return (
                <>
                    <RenderAst ast={ast.body} />
                    <br />
                </>
            )
        case 'Text':
            return ast.body
        case 'Marquee':
            return (
                <Box
                    sx={{
                        width: '100%',
                        overflow: 'hidden'
                    }}
                >
                    <Box
                        sx={{
                            animation: `${marquee} 10s linear infinite`
                        }}
                    >
                        <Box
                            sx={{
                                animation: `${flipMarquee} 10s linear infinite`,
                                width: 'max-content'
                            }}
                        >
                            <RenderAst ast={ast.body} />
                        </Box>
                    </Box>
                </Box>
            )
        case 'Italic':
            return (
                <i>
                    <RenderAst ast={ast.body} />
                </i>
            )
        case 'Bold':
            return (
                <b>
                    <RenderAst ast={ast.body} />
                </b>
            )
        case 'Strike':
            return (
                <s>
                    <RenderAst ast={ast.body} />
                </s>
            )
        case 'URL':
            return (
                <Link href={ast.body} target="_blank" rel="noopener noreferrer">
                    {ast.alt || ast.body}
                </Link>
            )
        case 'Timeline':
            return <span>#{ast.body}</span>
        case 'Spoiler':
            return (
                <Spoiler>
                    <RenderAst ast={ast.body} />
                </Spoiler>
            )
        case 'Quote':
            return (
                <blockquote style={{ margin: 0, paddingLeft: '1rem', borderLeft: '4px solid #ccc' }}>
                    <RenderAst ast={ast.body} />
                </blockquote>
            )
        case 'Tag':
            if (ast.body.match(/[0-9a-fA-F]{6}$/)) {
                return (
                    <>
                        <span>{ast.body}</span>
                        <span
                            style={{
                                backgroundColor: '#' + ast.body,
                                width: '1em',
                                height: '1em',
                                display: 'inline-block',
                                marginLeft: '0.25em',
                                borderRadius: '0.2em',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                verticalAlign: '-0.1em',
                                cursor: 'pointer'
                            }}
                            onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(ast.body)
                            }}
                        />
                    </>
                )
            }
            return <span>#{ast.body}</span>
        case 'Mention': {
            return <span>@{ast.body}</span>
        }
        case 'Emoji': {
            return <span>:{ast.body}:</span>
        }
        case 'Details':
            return (
                <details onClick={(e) => e.stopPropagation()}>
                    <summary>{ast.summary.body}</summary>
                    <RenderAst ast={ast.body} />
                </details>
            )
        case 'InlineCode':
            return (
                <Box
                    component="span"
                    sx={{
                        fontFamily: 'Source Code Pro, monospace',
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        borderRadius: 1,
                        border: '0.5px solid #ddd',
                        padding: '0 0.5rem',
                        margin: '0 0.2rem'
                    }}
                >
                    {ast.body}
                </Box>
            )
        case 'Image':
            return (
                <Box
                    src={ast.url}
                    alt={ast.alt}
                    component="img"
                    maxWidth="100%"
                    borderRadius={1}
                    sx={{
                        maxHeight: '20vh'
                    }}
                />
            )
        case 'CodeBlock':
            return <pre>{ast.body}</pre>
        case 'EmojiPack':
            return <>emojipack</>
        case 'Heading':
            return (
                <Typography variant={`h${ast.level}` as any}>
                    <RenderAst ast={ast.body} />
                </Typography>
            )
        default:
            return <>unknown ast type: {ast.type}</>
    }
}

export const CfmRenderer = (props: CfmRendererProps): ReactNode => {
    const [ast, setAst] = useState<any>(null)

    useEffect(() => {
        if (props.message === '') {
            setAst([])
            return
        }
        try {
            setAst(cfm.parse(props.message))
        } catch (e) {
            console.error(e)
            setAst([
                {
                    type: 'Text',
                    body: props.message
                },
                {
                    type: 'Text',
                    body: 'error: ' + JSON.stringify(e)
                }
            ])
        }
    }, [props.message])

    return (
        <Box
            sx={{
                whiteSpace: 'pre-wrap',
                fontSize: {
                    xs: '0.9rem',
                    sm: '1rem'
                }
            }}
        >
            <RenderAst ast={ast} />
        </Box>
    )
}
