;redcode-nano
;name My nano Qscan III
;author G.Labarga
;assert 1

x equ 30
y equ 70
d1 equ ptr+(x*y)-6
d2 equ ptr+(x*y)-1
d3 equ ptr+(x-1)-5

st:     sne.i d1,d2
        seq.i {ptr,d3
ptr:    mul.x #x,#y
clr:    mov <49,<ptr
        djn.f clr,{clr
end st

