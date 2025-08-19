import { cdid } from '../lib/cdid'

const baseURL = 'https://pub-01b22329d1ae4699af72f1db7103a0ab.r2.dev'

export const onRequest: PagesFunction<{ BUCKET: R2Bucket }> = async (context) => {
    const { request, env } = context

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    const id = cdid()
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown'
    const form = await request.formData()

    const manifestFile = form.get('manifest')
    if (!manifestFile || !(manifestFile instanceof File)) {
        return new Response('Manifest file is required', { status: 400 })
    }

    let manifest = {}

    try {
        const manifestText = await manifestFile.text()
        manifest = JSON.parse(manifestText)
    } catch (e) {
        return new Response('Invalid JSON in manifest', { status: 400 })
    }

    manifest['id'] = id

    const thumbnail = form.get('thumbnail')
    if (thumbnail && thumbnail instanceof File) {
        const mime = thumbnail.type || 'application/octet-stream'
        const thumbnailPath = `uploads/${id}/thumbnail`
        await env.BUCKET.put(thumbnailPath, thumbnail.stream(), {
            httpMetadata: { contentType: mime, contentDisposition: `inline; filename="${id}"` },
            customMetadata: { uploaderIp: ip }
        })
    }

    const texture = form.get('texture')
    if (!texture || !(texture instanceof File)) {
        return new Response('Texture file is required', { status: 400 })
    }

    const mime = texture.type || 'application/octet-stream'
    const texturePath = `uploads/${id}/texture`
    await env.BUCKET.put(texturePath, texture.stream(), {
        httpMetadata: { contentType: mime, contentDisposition: `inline; filename="${id}"` },
        customMetadata: { uploaderIp: ip }
    })
    manifest['textureURL'] = `${baseURL}/${texturePath}`

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
