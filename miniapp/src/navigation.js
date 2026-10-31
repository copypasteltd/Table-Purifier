// Shared by the native builders and the documentation renderer.
import {brand} from './brand.js';
export const rootPages=['MP01','MP13','MP14','MP15'];
export function headerTitle(page,title){return page==='MP01'?brand.name:page==='MP10'?'处理问题':title;}
export function navigationMarkup(page){if(!rootPages.includes(page))return '';const tabs=[['MP01','整理','folder'],['MP13','任务','clipboard'],['MP14','规范','grid'],['MP15','我的','user']].map(([id,label,icon])=>
 `<button class="nav-button ${id===page?'nav-current':''}" data-action="go-${id}" onTap="onAction" aria-label="${label}${id===page?'，当前页面':''}"><image class="nav-icon" src="/assets/icons/${icon}${id===page?'-filled':''}.png" aria-hidden="true"/><text>${label}</text></button>`).join('');
 return page==='MP01'?'<view class="home-footer"><b-actions p:if="{{ready}}" variant="embedded"><button class="button primary" data-action="analyze" onTap="onAction" disabled="{{loading||!sourceCount}}">检查资料</button></b-actions><b-navigation variant="embedded">'+tabs+'</b-navigation></view>':'<b-navigation>'+tabs+'</b-navigation>';}
