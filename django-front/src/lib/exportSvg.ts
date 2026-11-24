const CSS_VAR_REGEX = /var\((--[a-zA-Z0-9-]+)\)/g;

function resolveCssVarsInString(
  input: string,
  styles: CSSStyleDeclaration
): string {
  return input.replace(CSS_VAR_REGEX, (_, varName: string) => {
    const value = styles.getPropertyValue(varName).trim();
    return value || '#888888';
  });
}

export function exportSvgToPng(
  svgElement: SVGSVGElement,
  filename: string
): void {
  const rect = svgElement.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const rootStyles = getComputedStyle(document.documentElement);
  const bgColor = rootStyles.getPropertyValue('--bg').trim() || '#000000';

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.style.fontFamily =
    rootStyles.fontFamily || 'DM Sans, system-ui, sans-serif';

  const allElements = [clone, ...Array.from(clone.querySelectorAll('*'))];
  for (const el of allElements) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes('var(')) {
        el.setAttribute(attr.name, resolveCssVarsInString(attr.value, rootStyles));
      }
    }
    const inlineStyle = (el as HTMLElement).getAttribute('style');
    if (inlineStyle && inlineStyle.includes('var(')) {
      (el as HTMLElement).setAttribute(
        'style',
        resolveCssVarsInString(inlineStyle, rootStyles)
      );
    }
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = pngUrl;
      link.click();
    }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
