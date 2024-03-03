import * as events from './base/event';
import * as compile from './ulity/version';
import * as media from './base/export';
import * as endpoint from './endpoint/endpoint';
import * as resolution from './base/resolutionfind';
console.log("i in zlm.js");

console.log('build date:',compile.BUILD_DATE);
console.log('version:',compile.VERSION);

export const Events = events.default;
export const Media = media;
export const Endpoint = endpoint.default;
export const GetSupportCameraResolutions = resolution.default;
export const GetAllScanResolution = resolution.GetAllScanResolution;
export const isSupportResolution = resolution.isSupportResolution;
