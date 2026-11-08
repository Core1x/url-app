import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { AppError } from '../../protocol/src/index';

// Compatibility check, not a security sanitizer. Runtime isolation is mandatory
// even for payloads that did not go through this packager.
export function validateSingleFileHtml(html: string): void {
  const root = parse(html);
  const stack: DefaultTreeAdapterMap['node'][] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if ('childNodes' in node) for (const child of node.childNodes) stack.push(child);
    if (!('tagName' in node)) continue;
    if (node.tagName === 'template' && 'content' in node) stack.push(node.content);
    const attrs = new Map(node.attrs.map(attr => [attr.name, attr.value.trim()]));
    const incompatible = ['iframe', 'frame', 'object', 'embed', 'base'].includes(node.tagName)
      || (node.tagName === 'meta' && attrs.get('http-equiv')?.toLowerCase() === 'refresh')
      || (node.tagName === 'script' && attrs.has('src'))
      || (node.tagName === 'link' && attrs.has('href'))
      || attrs.has('srcset')
      || ['src', 'poster', 'background'].some(name => attrs.has(name) && !/^data:/i.test(attrs.get(name)!))
      || (node.tagName === 'use' && [...attrs].some(([name, value]) => name.endsWith('href') && !value.startsWith('#')));
    if (incompatible) {
      throw new AppError('EXTERNAL_RESOURCE', `V0.1 仅支持自包含 HTML：请内联或移除 <${node.tagName}> 中的外部资源/不支持的导航与嵌套内容。`);
    }
  }
}
