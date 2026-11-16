#!/usr/bin/env python3
"""Unwrap local WOFF1 fonts for desktop Pango; never downloads font assets."""
import struct,zlib,sys
from pathlib import Path

def convert(source,target):
    data=source.read_bytes()
    signature,flavor,length,count=struct.unpack_from('>4sIIH',data)
    if signature!=b'wOFF' or length!=len(data): raise ValueError('Expected WOFF1')
    power=2**(count.bit_length()-1)
    result=bytearray(struct.pack('>IHHHH',flavor,count,power*16,power.bit_length()-1,count*16-power*16))
    result.extend(bytes(16*count)); head=None
    for i in range(count):
        tag,offset,size,original,checksum=struct.unpack_from('>4sIIII',data,44+20*i)
        table=data[offset:offset+size]
        if size<original: table=zlib.decompress(table)
        if len(table)!=original: raise ValueError('Invalid font table')
        start=len(result)
        struct.pack_into('>4sIII',result,12+16*i,tag,checksum,start,original)
        result.extend(table);result.extend(bytes((-len(result))%4))
        if tag==b'head':head=start
    if head is not None:
        struct.pack_into('>I',result,head+8,0)
        checksum=sum(struct.unpack('>'+str(len(result)//4)+'I',result))&0xffffffff
        struct.pack_into('>I',result,head+8,(0xB1B0AFBA-checksum)&0xffffffff)
    target.write_bytes(result)
if __name__=='__main__': convert(Path(sys.argv[1]),Path(sys.argv[2]))
