import { cdid } from '../lib/cdid'

export const onRequest: PagesFunction<{ BUCKET: R2Bucket }> = async (context) => {
    const { request, env } = context

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown'

    const form = await request.formData()
    const file = form.get('file') as File
    if (!file) {
        return new Response('No file uploaded', { status: 400 })
    }
    const mime = file.type || 'application/octet-stream'

    const id = cdid()

    await env.BUCKET.put(id, file.stream(), {
        httpMetadata: { contentType: mime, contentDisposition: `inline; filename="${id}"` },
        customMetadata: { uploaderIp: ip }
    })

    const res = {
        id
    }

    const response = new Response(JSON.stringify(res), {
        headers: {
            'Content-Type': 'application/json'
        }
    })

    return response
}
