const wordmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 230" role="img" aria-label="Tsidkenu"><g fill="none" stroke="#D5B16A" stroke-width="8" stroke-linecap="round"><path d="M205 88c48-18 82-46 112-78"/><path d="M240 66c-4-25 5-43 25-54 4 23-4 41-25 54Z" fill="#D5B16A" stroke="none"/><path d="M274 43c17-24 38-34 65-28-15 22-36 31-65 28Z" fill="#D5B16A" stroke="none"/><path d="M313 18c25-11 48-7 66 12-23 13-45 9-66-12Z" fill="#D5B16A" stroke="none"/><path d="M269 63c27 1 47 13 61 36-26 4-46-8-61-36Z" fill="#D5B16A" stroke="none"/></g><text x="30" y="174" font-family="Georgia,Times New Roman,serif" font-size="118" font-weight="600" letter-spacing="-5" fill="#07372D">Tsidkenu</text><text x="35" y="210" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="7" fill="#8A6B34">LEGAL OPERATING SYSTEM</text></svg>`;

const darkWordmarkSvg = wordmarkSvg.replace('fill="#07372D">Tsidkenu', 'fill="#F8F4E8">Tsidkenu');

function dataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const TSIDKENU_PRODUCT_LOGO = dataUri(wordmarkSvg);
export const TSIDKENU_PRODUCT_LOGO_LIGHT_SURFACE = dataUri(wordmarkSvg);
export const TSIDKENU_PRODUCT_LOGO_DARK_SURFACE = dataUri(darkWordmarkSvg);
