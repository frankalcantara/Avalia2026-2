import {cookie,json} from '../../../lib/security.js';
export function onRequestPost(){return json({ok:true},200,{'Set-Cookie':cookie('hc_session','',0)});}
