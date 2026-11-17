// Link the complete installed extension without executing GNOME Shell code.
// GI/resource modules are inert stubs; real local exports must actually exist.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.argv[2]);
const names=new Set(['default']);
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file);
 else if(file.endsWith('.js'))for(const m of fs.readFileSync(file,'utf8').matchAll(/import\s*\{([^}]+)\}\s*from/g))
  for(const part of m[1].split(',')){const name=part.trim().split(/\s+as\s+/)[0];if(name)names.add(name);}
}}
scan(root);
const cache=new Map();
function local(file){if(!cache.has(file))cache.set(file,new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{identifier:file}));return cache.get(file);}
const external=new vm.SyntheticModule([...names],function(){for(const name of names)this.setExport(name,undefined);});
local(path.join(root,'extension.js')).link((specifier,ref)=>specifier.startsWith('.')?local(path.resolve(path.dirname(ref.identifier),specifier)):external)
 .then(()=>console.log('AppMenu local module exports/linking PASS'))
 .catch(error=>{console.error(error.message);process.exitCode=1;});
