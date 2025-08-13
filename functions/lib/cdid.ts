const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'

export function cdid(): string {
    // --- 10 bytes random ---
    const data = new Uint8Array(10)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(data)
    } else {
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 256) | 0
    }

    // --- 6 bytes time (ms since epoch, 48-bit big-endian) ---
    const t = BigInt(Date.now())
    const time = new Uint8Array(6)
    for (let i = 0; i < 6; i++) {
        const shift = BigInt((5 - i) * 8)
        time[i] = Number((t >> shift) & 0xffn)
    }

    // --- concat (16 bytes) ---
    const raw = new Uint8Array(16)
    raw.set(data, 0)
    raw.set(time, 10)

    // --- base32 encode (no padding, custom alphabet) ---
    let bits = 0
    let value = 0
    let out = ''
    for (let i = 0; i < raw.length; i++) {
        value = (value << 8) | raw[i]
        bits += 8
        while (bits >= 5) {
            out += ALPHABET[(value >> (bits - 5)) & 31]
            bits -= 5
        }
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]

    // 16 bytes -> 26 chars
    return out
}
