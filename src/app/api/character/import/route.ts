import { NextRequest, NextResponse } from 'next/server'
import { importDnDBeyondPdf } from '@/lib/character-import'

// Force Node runtime — pdfjs-dist needs the legacy build (no Edge).
export const runtime = 'nodejs'

/**
 * POST /api/character/import
 *
 * Accepts multipart/form-data with field `pdf` (a D&D Beyond multi-page
 * character export). Returns the parsed ImportedCharacter shape; the
 * client pre-fills the Chargen draft and lets the user review/commit.
 *
 * No persistence here — committing happens through /api/character/create
 * once the user confirms.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('pdf')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'pdf form field required' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'file too large (8MB max)' }, { status: 413 })
    }
    const buf = new Uint8Array(await file.arrayBuffer())
    const imported = await importDnDBeyondPdf(buf)
    return NextResponse.json({ imported })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'import failed' },
      { status: 500 }
    )
  }
}
