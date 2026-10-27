import { mockPaymentConfirmation } from './client.js';
export const provider = __P07_PROVIDER__;
export const environment = () => ({ provider, os: 'ANDROID', app_alias: 'documentation-only', host_version: 'NOT_A_DEVICE', base_sdk: 'NOT_RUN', build_id: 'docs-preview' });
export const navigate = async (page, query = {}) => window.__preview.navigate(page, query);
export const confirm = async () => window.confirm('仅为文档预览 / Documentation fixture\n确认继续展示该交互？不发生真实操作。');
export const uuid = () => crypto.randomUUID();
export const pay = async () => {
  window.__preview.caption(6, '模拟付款状态确认', 'Fixture confirmation only · No real transaction');
  await new Promise(resolve => setTimeout(resolve, 500)); mockPaymentConfirmation();
};
export const copyFileLink = async () => window.__preview.caption(7, '展示短期领取链接交互', 'No actual file or link is issued by this preview');
const unavailable = async () => { throw new Error('文档预览不执行真实文件、支付或设备操作。'); };
export const chooseImage = unavailable, chooseOffice = unavailable, fileBytes = unavailable,
  upload = unavailable, fetchFile = unavailable, openFile = unavailable;
