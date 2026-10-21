import { ICON_SIZES, renderAppIcon } from '@/_app/app-icon'

export function generateImageMetadata() {
  return ICON_SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: 'image/png',
  }))
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return renderAppIcon(Number(await id))
}
