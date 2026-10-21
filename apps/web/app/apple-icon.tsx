import { renderAppIcon } from '@/_app/app-icon'

/** iOS 홈 화면 아이콘(`apple-touch-icon`) 권장 크기. */
const APPLE_ICON_SIZE = 180

export const size = { width: APPLE_ICON_SIZE, height: APPLE_ICON_SIZE }
export const contentType = 'image/png'

export default function AppleIcon() {
  return renderAppIcon(APPLE_ICON_SIZE)
}
