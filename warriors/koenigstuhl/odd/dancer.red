;redcode
;author Sascha Zapf
;name Dancer
;assert 1

hop EQU 1105

s spl 1
mov.i -1,0
mov.i -1,0
jmp st
ptr dat.f 0,hop
st mov.i }ptr,>ptr
mov.i ptr,}-200
mov.i ptr,>-300
jmp ptr+hop+1

end s
