import { createPage } from '../../miniapp/src/controller.js';
import { components } from '../../miniapp/src/components.js';
import { titles } from '../../miniapp/src/pages.generated.js';
import { state, reset, issue, sampleText } from './client.js';
const templates = __TEMPLATES__, provider = __P07_PROVIDER__;
let current, renderPending = false;
const app = document.getElementById('app');
const steps = ['创建会话 / Prepare session', '提交资料 / Add sources', 'Agent 分析 / Analyze', '确认规范 / Confirm', '预估费用 / Estimate', '实付后生产 / Produce', '保留结果 / Retain results'];
document.getElementById('provider').textContent = provider === 'ALIPAY' ? '支付宝 · Alipay' : '抖音 · Douyin';
document.getElementById('steps').innerHTML = steps.map((s, i) => `<li data-step="${i + 1}"><span>0${i + 1}</span>${s}</li>`).join('');
function expression(code, scope) {
  try { return Function('scope', `with(scope){return (${code});}`)(scope); } catch { return undefined; }
}
function value(text, scope) {
  const exact = text.match(/^\{\{((?:(?!\}\})[\s\S])+)\}\}$/);
  if (exact) return expression(exact[1], scope);
  return text.replace(/\{\{([\s\S]+?)\}\}/g, (_, code) => expression(code, scope) ?? '');
}
function parse(source) {
  const t = document.createElement('template');
  // Native self-closing custom elements need explicit end tags in the HTML parser.
  t.innerHTML = source.replace(/<([\w-]+)([^<>]*?)\/>/g, (_, tag, attrs) => ['input', 'img', 'br'].includes(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}></${tag}>`);
  return [...t.content.childNodes];
}
function nodes(list, scope, component = null, slots = null) {
  const result = document.createDocumentFragment();
  for (const source of list) {
    if (source.nodeType === Node.TEXT_NODE) { result.append(document.createTextNode(value(source.textContent, scope) ?? '')); continue; }
    if (source.nodeType !== Node.ELEMENT_NODE) continue;
    if (source.hasAttribute('p:for')) {
      const entries = value(source.getAttribute('p:for'), scope) || [];
      entries.forEach((item, index) => {
        const child = source.cloneNode(true); child.removeAttribute('p:for');
        result.append(nodes([child], { ...scope, [source.getAttribute('p:for-item') || 'item']: item, index }, component, slots));
      }); continue;
    }
    if (source.hasAttribute('p:if') && !value(source.getAttribute('p:if'), scope)) continue;
    const tag = source.tagName.toLowerCase();
    if (tag === 'slot') { if (slots) result.append(nodes(slots.children, slots.scope, slots.component)); continue; }
    if (components[tag]) {
      const props = { title: '', text: '', action: '', itemId: '', variant: '', disabled: false, loading: false, selected: false, count: 0 };
      for (const attr of source.attributes) props[attr.name === 'itemid' ? 'itemId' : attr.name] = value(attr.value, scope);
      result.append(nodes(parse(components[tag].xml), props, { props, handler: source.getAttribute('onaction') }, { children: [...source.childNodes], scope, component }));
      continue;
    }
    const target = document.createElement(tag);
    for (const attr of source.attributes) {
      if (attr.name.startsWith('p:') || attr.name.startsWith('on')) continue;
      const v = value(attr.value, scope);
      if (attr.name === 'disabled' || attr.name === 'loading') { if (v) target.setAttribute(attr.name, ''); continue; }
      if (v !== undefined && v !== null) target.setAttribute(attr.name, String(v));
    }
    if (tag === 'input' || tag === 'textarea') target.value = value(source.getAttribute('value') || '', scope) ?? '';
    const tap = source.getAttribute('ontap');
    if (tap) target.addEventListener('click', event => {
      event.stopPropagation(); const e = { currentTarget: { dataset: { ...target.dataset } }, detail: {} };
      if (tap === 'act' && component?.handler) current[component.handler]?.({ detail: { action: component.props.action, id: component.props.itemId } });
      else current[tap]?.(e);
    });
    const input = source.getAttribute('oninput');
    if (input) target.addEventListener('input', () => current[input]?.({ currentTarget: { dataset: { ...target.dataset } }, detail: { value: target.value } }));
    target.append(nodes([...source.childNodes], scope, component, slots)); result.append(target);
  }
  return result;
}
function render() {
  renderPending = false; if (!current) return;
  const id = current.data.page, tabs = ['MP01', 'MP13', 'MP14', 'MP15'].includes(id)
    ? `<b-navigation>${[['MP01', '整理'], ['MP13', '任务'], ['MP14', '规范'], ['MP15', '我的']].map(([tab, text]) => `<view class="nav-button ${id === tab ? 'nav-current' : ''}" data-action="go-${tab}" onTap="onAction">${text}</view>`).join('')}</b-navigation>` : '';
  const markup = `<b-frame><view p:if="{{loading}}" class="notice">正在处理，请稍候……</view><view p:if="{{error}}" class="error">{{error}}</view><b-message text="{{notice}}"/>${templates[id]}</b-frame>${tabs}`;
  const top = app.scrollTop; app.replaceChildren(nodes(parse(markup), current.data)); app.scrollTop = top;
  document.getElementById('page-title').textContent = titles[id];
  document.getElementById('page-code').textContent = id;
  document.body.dataset.page = id;
  document.body.dataset.busy = String(current.data.loading);
}
async function navigate(id, query = {}) {
  current?.onHide(); current?.onUnload(); current = createPage(id);
  const instance = current;
  current.setData = data => { Object.assign(instance.data, data); if (current === instance && !renderPending) { renderPending = true; queueMicrotask(render); } };
  current.onLoad(query); app.scrollTop = 0; render(); current.onShow();
}
function caption(step, title, subtitle) {
  document.getElementById('caption-title').textContent = title;
  document.getElementById('caption-en').textContent = subtitle;
  document.querySelectorAll('[data-step]').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === step));
}
window.__preview = {
  navigate, caption, state, sampleText,
  get current() { return current; },
  async seed(id, stage = 'delivered') {
    current?.onUnload(); reset(stage);
    if (id === 'MP03') { state.task.mode = 'PROVIDED'; state.selectedTemplate = await (await import('./client.js')).api('/private-templates/demo-template'); }
    if (id === 'MP10') state.selectedIssue = issue;
    await navigate(id, id === 'MP11' ? { evidence: 'demo-evidence' } : {});
  },
  dispose() { current?.onHide(); current?.onUnload(); current = null; },
};
document.getElementById('back').onclick = () => navigate('MP01');
document.getElementById('restart').onclick = async () => { reset(); caption(1, '先准备会话，再接收资料', 'Session and full Skill must be ready before input'); await navigate('MP01'); };
document.getElementById('gallery').onchange = e => window.__preview.seed(e.target.value,
  ['MP01', 'MP02'].includes(e.target.value) ? 'ready' : ['MP03', 'MP06', 'MP07'].includes(e.target.value) ? 'analysis' : e.target.value === 'MP04' ? 'quoted' : 'delivered');
document.getElementById('gallery').innerHTML = Object.entries(titles).map(([id, title]) => `<option value="${id}">${id} · ${title}</option>`).join('');
caption(1, '先准备会话，再接收资料', 'Session and full Skill must be ready before input');
navigate('MP01');
