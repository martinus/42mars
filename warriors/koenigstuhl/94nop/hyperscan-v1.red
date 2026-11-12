;redcode-94nop
;name Hyperscan v1
;author Roy van Rijn
;strategy Rethinking what a qscan can be
;strategy Oneshot with 284 scans in 299 cycles
;assert 1

tablen equ 71
tabend equ tabtop + tablen
tabtop
n for tablen
dat zero - (48*n), zero + 50 + (49*n)
rof

zero equ tabtop-1

bdist equ 4084
bptr equ (ptr+bdist)

wgo
mov.i ptr+9,bptr+11
mov.i ptr+8,bptr+10
mov.i ptr+8,bptr+9
mov.i ptr+7,bptr+8
add.b ptr+7,}bptr+7
mov.i ptr+6,bptr+6
mov.i ptr+5,bptr+5
mov.i ptr+4,bptr+4
mov.i ptr+3,bptr+3
mov.i ptr+2,bptr+2
mov.i ptr+1,bptr+1
mov.i ptr,bptr
mov.i ptr-1,bptr-1
mov.i ptr-2,bptr-2
mov.i ptr-3,bptr-3
boot djn.f bptr-3,bptr+10

; small scanner and SD clear

mov.f *ptr,top
top seq.i top,top
jmp 5
ptr sne.i *tabend-1-bdist, @tabend-1-bdist
djn.f -4,-1
add.f ptr,top
add.f #2,@2
jmz.f 4,*top
mov.x top,top
djn.b 2,top
;      dat     1,      15
        spl     #224,    15
        mov     *-2,    >-11
;       mov     *-3,    >top
        djn.f   -2,     }-3
end wgo

