import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
// Honor the inherited proxy in managed cloud workspaces. Normal hosting uses direct HTTPS.
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) setGlobalDispatcher(new EnvHttpProxyAgent());
