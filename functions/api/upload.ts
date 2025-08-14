import { cdid } from '../lib/cdid'

const baseURL = 'https://pub-01b22329d1ae4699af72f1db7103a0ab.r2.dev'

const keys = [
    'Head-Front',
    'Head-Back',
    'Eyes-Closed',
    'Mouth-Open',
    'Body-Front',
    'Body-Back',
    'Hand-Front',
    'Hand-Back',
    'Legs-Front',
    'Legs-Back',
    'Tail-Front',
    'Tail-Back'
]

export const onRequest: PagesFunction<{ BUCKET: R2Bucket }> = async (context) => {
    const { request, env } = context

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    const id = cdid()
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown'
    const form = await request.formData()

    const manifestFile = form.get('manifest.json')
    if (!manifestFile || !(manifestFile instanceof File)) {
        return new Response('Manifest file is required', { status: 400 })
    }
    let manifest: any = {}
    try {
        const manifestText = await manifestFile.text()
        manifest = JSON.parse(manifestText)
    } catch (e) {
        return new Response('Invalid JSON in manifest', { status: 400 })
    }

    for (const key of keys) {
        if (!form.has(key)) {
            return new Response(`Missing required field: ${key}`, { status: 400 })
        }

        const file = form.get(key) as File
        if (!file) {
            return new Response('No file uploaded', { status: 400 })
        }

        const mime = file.type || 'application/octet-stream'

        const path = `uploads/${id}/${key}`

        await env.BUCKET.put(path, file.stream(), {
            httpMetadata: { contentType: mime, contentDisposition: `inline; filename="${id}"` },
            customMetadata: { uploaderIp: ip }
        })

        manifest['textures'][key] = `${baseURL}/${path}`
    }

    manifest['id'] = id

    const manifestString = JSON.stringify(manifest)

    // Store the manifest file
    await env.BUCKET.put(`uploads/${id}/manifest.json`, manifestString, {
        httpMetadata: { contentType: 'application/json', contentDisposition: `inline; filename="manifest.json"` },
        customMetadata: { uploaderIp: ip }
    })

    const response = new Response(manifestString, {
        headers: {
            'Content-Type': 'application/json'
        }
    })

    return response
}
