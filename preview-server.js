// Local preview of the same bundled Worker that Sites publishes.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.env.PORT || 4173);
const source = fs.readFileSync(path.join(__dirname, 'dist/server/index.js'), 'utf8');
const worker = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
http.createServer(async (incoming, outgoing) => {
  try {
    const chunks=[];for await (const chunk of incoming) chunks.push(chunk);
    const body=Buffer.concat(chunks);
    const request=new Request(`http://127.0.0.1:${port}${incoming.url}`,{
      method:incoming.method,
      headers:incoming.headers,
      body:['GET','HEAD'].includes(incoming.method)?undefined:body
    });
    const response=await (await worker).default.fetch(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY||'',OPENAI_MODEL:process.env.OPENAI_MODEL||''});
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500,{'content-type':'text/plain'});
    outgoing.end('Preview error');
  }
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
