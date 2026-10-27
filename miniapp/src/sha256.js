/* Bounded synchronous SHA-256 over selected bytes; uploaded bytes are independently hashed by the Host. */
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const R=(x,n)=>(x>>>n)|(x<<(32-n));
export function sha256(bytes){const size=Math.ceil((bytes.length+9)/64)*64,b=new Uint8Array(size);b.set(bytes);b[bytes.length]=128;
 const dv=new DataView(b.buffer),bits=bytes.length*8;dv.setUint32(size-8,Math.floor(bits/4294967296));dv.setUint32(size-4,bits>>>0);
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64);
 for(let o=0;o<size;o+=64){for(let j=0;j<16;j++)w[j]=dv.getUint32(o+j*4);for(let j=16;j<64;j++)w[j]=(w[j-16]+(R(w[j-15],7)^R(w[j-15],18)^(w[j-15]>>>3))+w[j-7]+(R(w[j-2],17)^R(w[j-2],19)^(w[j-2]>>>10)))>>>0;
  let[a,c,d,e,f,g,i,j]=h;for(let t=0;t<64;t++){const p=(j+(R(f,6)^R(f,11)^R(f,25))+((f&g)^(~f&i))+K[t]+w[t])>>>0,q=((R(a,2)^R(a,13)^R(a,22))+((a&c)^(a&d)^(c&d)))>>>0;j=i;i=g;g=f;f=(e+p)>>>0;e=d;d=c;c=a;a=(p+q)>>>0;}
  [a,c,d,e,f,g,i,j].forEach((v,n)=>h[n]=(h[n]+v)>>>0);
 }return h.map(n=>n.toString(16).padStart(8,'0')).join('');}
